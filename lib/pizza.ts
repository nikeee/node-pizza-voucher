#!/usr/bin/env node
"use strict";

import * as request from "request";
import * as yargs from "yargs";
import * as crypto from "crypto";
import * as promptly from "promptly";
import * as moment from "moment";

import Table = require("easy-table");

type Cookies = request.CookieJar;

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
	builder: (_: yargs.Argv) => _,
	handler: (argv: any) => list(argv)
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
	handler: (argv: any) => redeem(argv)
};

let args = yargs
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

let errors = {
	loginFailed: (err: Error) => {
		console.error("An error ocurred during login. You max have passed the wromg password/username.");
		console.error(`"${err.message}"`);
		process.exit(1);
	},
	voucherListFailed: (err: Error) => {
		console.error("Could not fetch current voucher list.");
		console.error(`"${err.message}"`);
		process.exit(2);
	},
	voucherAddFailed: (err: Error) => {
		console.error("Could not redeem voucher.");
		console.error(`"${err.message}"`);
		process.exit(3);
	},
	loginCancelled: () => {
		console.error("Login cancelled.")
		process.exit(4);
	}
};

class ApiError extends Error {
	constructor(err?: IPizzaError) { super(err ? err.description : "An error during pizza operation ocurred."); }
}

function requestPassword(argv: IArgs): Promise<string> {
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

async function list(argv: IArgs): Promise<void> {
	try {
		const password = await requestPassword(argv);
		try {
			const cookies = await login(argv.user, password);
			try {
				const res = await getVoucherList(cookies);
				fixVouchers(res.vouchers);
				printVouchers(res.vouchers);
			} catch (voucherListFailed) {
				return errors.voucherListFailed(voucherListFailed);
			}
		}
		catch (loginFailed) {
			return errors.loginFailed(loginFailed);
		}
	}
	catch (loginCancelled) {
		return errors.loginCancelled();
	}
}

async function redeem(argv: IRedeemArgs): Promise<void> {
	try {
		const password = await requestPassword(argv);
		try {
			const cookies = await login(argv.user, password);
			try {
				const res = await redeemVoucher(cookies, argv.voucher);
				console.log(`Code ${res.voucher} redeemed successfully!`);
				console.log("Current vouchers:");
				fixVouchers(res.vouchers);
				printVouchers(res.vouchers);
			} catch (voucherAddFailed) { return errors.voucherAddFailed(voucherAddFailed); }
		} catch (loginFailed) { return errors.loginFailed(loginFailed); }
	} catch (loginCancelled) { return errors.loginCancelled(); }

}

function login(user: string, password: string): Promise<Cookies> {
	const pwHash = getPasswordHash(password);
	const options = getRequestOptions(UserAuthUrl, "POST");
	options.form = {
		username: user,
		hash: pwHash
	};

	return new Promise<Cookies>((resolve, reject) => {
		request(options, (error, httpResp, body: IApiResponse) => {
			if (!body.success)
				return reject(body.error);
			return resolve(options.jar);
		});
	});
}

function getVoucherList(cookies: Cookies): Promise<IVoucherListResponse> {
	const options = getRequestOptions(VoucherListUrl, "GET", cookies);
	return new Promise<IVoucherListResponse>((resolve, reject) => {
		request(options, (error, httpResp, body: IVoucherListResponse) => {
			if (!body.success) return reject(new ApiError(body.error));
			return resolve(body);
		});
	});
}

function redeemVoucher(cookies: Cookies, code: string): Promise<IVoucherAddResponse> {
	const options = getRequestOptions(VoucherAddUrl, "POST", cookies);
	options.form = { voucher: code };
	return new Promise<IVoucherAddResponse>((resolve, reject) => {
		request(options, (error, httpResp, body: IVoucherAddResponse) => {
			if (!body.success) return reject(new ApiError(body.error));
			fixVouchers(body.vouchers);
			return resolve(body);
		});
	});
}

function currencyPrinter(val: number, width: number): string {
	var str = val.toFixed(2);
	return width ? str : Table.padLeft(str, width);
}

function printVouchers(vouchers: IVoucher[]): void {
	if (vouchers.length == 0) {
		console.log("No vouchers redeemed. :(");
		return;
	}
	var t = new Table();
	for (var v of vouchers) {
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

function fixVouchers(vs: IVoucher[] | undefined): void {
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

function getRequestOptions(uri: string, method: string, cookies: Cookies = request.jar()): request.Options {
	return {
		uri: uri,
		headers: { "User-Agent": UserAgent },
		method: method,
		jar: cookies,
		json: true
	};
}

function getPasswordHash(password: string): string {
	const md5 = crypto.createHash("md5");
	let hash = md5.update(password, "utf8").digest("base64");
	while (hash[hash.length - 1] === "=")
		hash = hash.slice(0, -1);
	return hash;
}
