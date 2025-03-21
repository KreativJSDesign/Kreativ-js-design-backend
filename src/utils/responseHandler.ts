import { Response } from "express";

export const SendErrorResponse = (
  res: Response,
  statusCode: number,
  message: string,
) => {
  res.status(statusCode).json({
    status: false,
    message,
  });
};
export const sendSuccessResponse = (
  res: Response,
  data: any,
  message: string,
) => {
  res.status(200).json({
    status: true,
    data: data,
    message,
  });
};
export const sendSuccessWithoutResponse = (res: Response, message: string) => {
  res.status(200).json({
    status: true,
    message,
  });
};
