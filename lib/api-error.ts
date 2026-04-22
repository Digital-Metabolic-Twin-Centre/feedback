export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public redirectUrl?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
