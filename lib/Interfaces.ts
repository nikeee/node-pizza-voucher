interface PizzaArgs { user: string; password: string; }
type ListArgs = PizzaArgs;
interface RedeemArgs extends PizzaArgs { voucher: string; }

interface PizzaError {
	description: string;
	code: string;
}

interface ApiResponse {
	success: boolean;
	error?: PizzaError;
}
interface LoginResponse extends ApiResponse {
	/**
	 * Not used in this tool. May be used to log in again without the password.
	 */
	token: string;
}
interface VoucherAddResponse extends ApiResponse {
	voucher: string;
	vouchers: Voucher[];
}
interface VoucherListResponse extends ApiResponse {
	voucher: Voucher[];
	vouchers: Voucher[];
}

interface Voucher {
	limit_per_order: number;
	valid_from: string | Date;
	instance: number;
	def_id: number;
	remaining_value: number;
	desc: string;
	valid_until: string | Date;
	authorized_value: number;
	label: string;
	original_value: number;
	code: string;
}

interface Cookies { [key: string]: string }
