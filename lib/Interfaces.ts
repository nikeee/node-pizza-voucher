interface IArgs { user: string; password: string; }
interface IRedeemArgs extends IArgs { voucher: string; }

interface IPizzaError
{
	description: string;
	code: string;
}

interface IApiResponse
{
	success: boolean;
	error?: IPizzaError;
}
interface ILoginResponse extends IApiResponse { }
interface IVoucherAddResponse extends IApiResponse
{
	voucher: string;
	vouchers: IVoucher[];
}
interface IVoucherListResponse extends IApiResponse
{
	voucher: IVoucher[];
	vouchers: IVoucher[];
}

interface IVoucher
{
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
