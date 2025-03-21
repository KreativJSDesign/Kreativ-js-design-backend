import { Request, Response } from "express";
import {
  SendErrorResponse,
  sendSuccessResponse,
} from "../utils/responseHandler";
import TransactionModel from "../model/transactionModel";
import TemplateModel, { TemplateDocument } from "../model/templateModel";

export const CustomizeCard = async (req: Request, res: Response) => {
  try {
    const { cardBody, cardHeader, customCardId, listing_id, templateId } =
      req.body;
    let transactionInfo;

    if (customCardId) {
      transactionInfo = await TransactionModel.findByIdAndUpdate(
        customCardId,
        {
          $set: {
            complete: true,
            "cardBody.text": cardBody?.text,
            "cardBody.fontStyle": cardBody?.fontStyle,
            "cardBody.fontSize": cardBody?.fontSize,
            "cardBody.fontWeight": cardBody?.fontWeight,
            "cardBody.textAlignment": cardBody?.textAlignment,
            "cardBody.fontColor": cardBody?.fontColor,
            "cardHeader.text": cardHeader?.text,
            "cardHeader.fontStyle": cardHeader?.fontStyle,
            "cardHeader.fontSize": cardHeader?.fontSize,
            "cardHeader.fontWeight": cardHeader?.fontWeight,
            "cardHeader.textAlignment": cardHeader?.textAlignment,
            "cardHeader.fontColor": cardHeader?.fontColor,
          },
        },
        { new: true },
      );

      if (transactionInfo) {
        return sendSuccessResponse(
          res,
          transactionInfo,
          "Card customization is complete",
        );
      }
    }

    const newTransaction = new TransactionModel({
      complete: true,
      lastDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      listing_id: listing_id ? listing_id : null,
      templateId: templateId,
      cardBody: {
        text: cardBody?.text,
        fontStyle: cardBody?.fontStyle,
        fontSize: cardBody?.fontSize,
        fontWeight: cardBody?.fontWeight,
        textAlignment: cardBody?.textAlignment,
        fontColor: cardBody?.fontColor,
      },
      cardHeader: {
        text: cardHeader?.text,
        fontStyle: cardHeader?.fontStyle,
        fontSize: cardHeader?.fontSize,
        fontWeight: cardHeader?.fontWeight,
        textAlignment: cardHeader?.textAlignment,
        fontColor: cardHeader?.fontColor,
      },
    });

    transactionInfo = await newTransaction.save();
    return sendSuccessResponse(
      res,
      transactionInfo,
      "New custom card is created",
    );
  } catch (error) {
    console.error("Error customizing card:", error);
    return SendErrorResponse(
      res,
      500,
      "Error occurred while creating a custom card",
    );
  }
};

export const SingleCardInfo = async (req: Request, res: Response) => {
  try {
    const customeCardId = req.params.cardId;
    const customCardInfo = await TransactionModel.findById(customeCardId);
    if (customCardInfo) {
      // ✅ Check if the card has expired and not customize
      if (!customCardInfo.complete && customCardInfo.lastDate < new Date()) {
        return SendErrorResponse(
          res,
          410,
          "Card customization period has expired. Please check the URL again.",
        );
      }
      // ✅ Check if card is already completed
      if (customCardInfo.complete) {
        return sendSuccessResponse(
          res,
          customCardInfo,
          "This URL has already been used.",
        );
      }

      const allTemplate: TemplateDocument[] | null = await TemplateModel.find(
        {},
      );

      const templateInfo = allTemplate?.find((data: TemplateDocument) =>
        data.productId?.includes(customCardInfo.listing_id.toString()),
      );

      const response = {
        templateInfo,
        customCardInfo,
      };

      return sendSuccessResponse(
        res,
        response,
        "Card info retrieved successfully.",
      );
      // ✅ Fetch related template info
    }

    // ✅ If no custom card is found, check if it's a template card
    const templateCardInfo = await TemplateModel.findById(customeCardId);

    if (!templateCardInfo) {
      return SendErrorResponse(res, 404, "Template card does not exist.");
    }

    return sendSuccessResponse(
      res,
      templateCardInfo,
      "Template card info retrieved.",
    );
  } catch (error) {
    console.error("Error fetching card info:", error);
    return SendErrorResponse(res, 500, "Error getting card info.");
  }
};
export const ScratchCardInfo = async (req: Request, res: Response) => {
  try {
    const ScratchCardId = req.params.cardId;
    const customCardInfo = await TransactionModel.findById(ScratchCardId);

    if (!customCardInfo) {
      return SendErrorResponse(res, 403, "Scratch Card Info Not Found");
    }

    if (!customCardInfo.cardViewUrl) {
      const scratchCardLink = `/card-view/${ScratchCardId}`;
      await TransactionModel.updateOne(
        { _id: ScratchCardId },
        { $set: { cardViewUrl: scratchCardLink } },
      );
    }

    // ✅ Fetch related template info more efficiently
    let templateInfo: TemplateDocument | null = null;

    if (customCardInfo.listing_id == null) {
      templateInfo = await TemplateModel.findOne({
        _id: customCardInfo.templateId,
      });
    } else {
      templateInfo = await TemplateModel.findOne({
        productId: { $in: [customCardInfo.listing_id.toString()] },
      });
    }

    return sendSuccessResponse(
      res,
      { templateInfo, customCardInfo },
      "Card info retrieved successfully.",
    );
  } catch (error) {
    console.error("Error fetching card info:", error);
    return SendErrorResponse(res, 500, "Error getting card info.");
  }
};
