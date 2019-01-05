#!/usr/bin/env node
"use strict";

import * as needle from "needle";
import * as yargs from "yargs";
import * as crypto from "crypto";
import * as promptly from "promptly";
import * as moment from "moment";

import Table = require("easy-table");

const UserAgent = "Dalvik/2.1.0 (Linux; Android 5.0.2; samsung; SM-T800) de.pizza/3.0.19 xCore/3983";
const ApiUrl = "https://pizza.de/api/2/";
const UserAuthUrl = `${ApiUrl}user/auth`;
const VoucherUrl = `${ApiUrl}voucher/`;
const VoucherListUrl = `${VoucherUrl}list`;
const VoucherAddUrl = `${VoucherUrl}add`;

const listCommand = {
	command: "list",
	aliases: ["ls"],
	desc: "List current available vouchers.",
	handler: (argv: ListArgs) => list(argv),
};
const redeemCommand = {
	command: "redeem",
	aliases: [],
	desc: "Redeem a pizza.de voucher code.",
	builder: {
		"voucher": {
			required: true,
			alias: "v",
			describe: "pizza.de voucher code to redeem"
		}
	},
	handler: (argv: RedeemArgs) => redeem(argv),
};

const args = yargs
	.option("user", {
		type: "string",
		alias: "u",
		describe: "pizza.de user name",
		required: true
	})
	.option("password", {
		type: "string",
		alias: "p",
		describe: "pizza.de password; will be prompted if not provided",
		default: null,
		required: false
	})
	.global(["user", "password"])
	.command(redeemCommand)
	.command(listCommand)
	.help().alias("h", "help")
	.wrap(yargs.terminalWidth())
	.argv;

const errors = {
	loginFailed: (err: Error) => {
		console.error("An error ocurred during login. You may have passed the wrong password/username combination.");
		console.error(err.message);
		process.exit(1);
	},
	voucherListFailed: (err: Error) => {
		console.error("Could not fetch current voucher list.");
		console.error(err.message);
		process.exit(2);
	},
	voucherAddFailed: (err: Error) => {
		console.error("Could not redeem voucher.");
		console.error(err.message);
		process.exit(3);
	},
	loginCancelled: () => {
		console.error("Login cancelled.")
		process.exit(4);
	}
};

class ApiError extends Error {
	constructor(err?: PizzaError) { super(err ? `Pizza.de responded with code ${err.code}: ${err.description}` : "An error during pizza operation ocurred."); }
}

function requestPassword(argv: PizzaArgs): Promise<string> {
	console.assert(argv);

	if (argv.password !== null)
		return Promise.resolve(argv.password);
	return new Promise<string>((resolve, reject) => {
		promptly.password(`Enter pizza.de password for account ${argv.user}:`, {
			silent: true,
			default: undefined,
			trim: false
		}, (err, res) => err ? reject(err) : resolve(res));
	});
}

async function list(argv: PizzaArgs): Promise<void> {
	console.assert(argv);

	try {
		const password = await requestPassword(argv);
		try {
			const cookies = await login(argv.user, password);
			try {
				const res = await getVoucherList(cookies);
				printVouchers(res.vouchers);
			} catch (voucherListFailed) { return errors.voucherListFailed(voucherListFailed); }
		} catch (loginFailed) { return errors.loginFailed(loginFailed); }
	} catch (loginCancelled) { return errors.loginCancelled(); }
}

async function redeem(argv: RedeemArgs): Promise<void> {
	try {
		const password = await requestPassword(argv);
		try {
			const cookies = await login(argv.user, password);
			try {
				const res = await redeemVoucher(cookies, argv.voucher);
				console.log(`Code ${res.voucher} redeemed successfully!`);
				console.log("Current vouchers:");
				printVouchers(res.vouchers);
			} catch (voucherAddFailed) { return errors.voucherAddFailed(voucherAddFailed); }
		} catch (loginFailed) { return errors.loginFailed(loginFailed); }
	} catch (loginCancelled) { return errors.loginCancelled(); }

}

function login(username: string, password: string): Promise<Cookies> {
	console.assert(username);
	console.assert(password);

	const hash = getPasswordHash(password);
	const options = {
		headers: { user_agent: UserAgent },
	};
	const data = { username, hash };

	return new Promise<Cookies>((resolve, reject) => {
		needle.post(UserAuthUrl, data, options, (err, resp) => {
			if (err) return reject(err);
			const body = resp.body as LoginResponse;
			if (!body.success) return reject(new ApiError(body.error));
			console.assert((resp as any).cookies);
			resolve((resp as any).cookies);
		});
	});
}

function getVoucherList(cookies: Cookies): Promise<VoucherListResponse> {
	console.assert(cookies);

	const options = {
		headers: { user_agent: UserAgent },
		cookies
	};

	return new Promise<VoucherListResponse>((resolve, reject) => {
		needle.get(VoucherListUrl, options, (err, resp) => {
			if (err) return reject(err);
			const body = resp.body as VoucherListResponse;
			if (!body.success) return reject(new ApiError(body.error));
			fixVouchers(body.vouchers);
			resolve(body);
		});
	});
}

function redeemVoucher(cookies: Cookies, voucher: string): Promise<VoucherAddResponse> {
	console.assert(cookies);
	console.assert(voucher);

	const options = {
		headers: { user_agent: UserAgent },
		cookies
	};
	const data = { voucher };

	return new Promise<VoucherAddResponse>((resolve, reject) => {
		needle.post(VoucherAddUrl, data, options, (err, resp) => {
			if (err) return reject(err);
			const body = resp.body as VoucherAddResponse;
			if (!body.success) return reject(new ApiError(body.error));
			fixVouchers(body.vouchers);
			resolve(body);
		});
	});
}

function currencyPrinter(val: number, width: number): string {
	const str = val.toFixed(2);
	return width ? str : Table.padLeft(str, width);
}

function printVouchers(vouchers: Voucher[]): void {
	console.assert(vouchers);

	if (vouchers.length === 0) {
		console.log("No vouchers redeemed. :(");
		return;
	}
	const t = new Table();
	for (const v of vouchers) {
		t.cell("Description", v.desc);
		t.cell("Code", v.code);
		t.cell("Original Value", v.original_value, currencyPrinter);
		t.cell("Remaining Value", v.remaining_value, currencyPrinter);
		t.cell("Valid Until", v.valid_until, (value, width) => moment(value).fromNow(true));
		t.newRow();
	}
	t.sort(["Valid Until"]);
	t.total("Remaining Value", {
		printer: Table.aggr.printer<number>("Total: ", currencyPrinter),
		reduce: void 0
	});
	console.log(t.toString());
}

function fixVouchers(vs: Voucher[] | undefined): void {
	if (vs === undefined || vs.length === 0)
		return;

	for (const v of vs) {
		if (typeof v.valid_from === "string")
			v.valid_from = new Date(v.valid_from as string);
		if (typeof v.valid_until === "string")
			v.valid_until = new Date(v.valid_until as string);

		v.remaining_value /= 100;
		v.original_value /= 100;
	}
}

function getPasswordHash(password: string): string {
	const md5 = crypto.createHash("md5");
	let hash = md5.update(password, "utf8").digest("base64");
	while (hash[hash.length - 1] === "=")
		hash = hash.slice(0, -1);
	return hash;
}
