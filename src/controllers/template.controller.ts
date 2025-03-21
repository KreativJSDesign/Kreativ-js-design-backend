import { Request, Response } from "express";
import TemplateModel from "../model/templateModel";
import {
  SendErrorResponse,
  sendSuccessResponse,
  sendSuccessWithoutResponse,
} from "../utils/responseHandler";
import { supabase } from "../utils/supabaseClient";

export const uploadTemplate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files?.background?.[0] || !files?.sticker?.[0]) {
      return SendErrorResponse(res, 400, "Both images must be uploaded.");
    }

    const backgroundFile = files.background[0];
    const stickerFile = files.sticker[0];
    const { productId } = req.body;

    const bucketName = process.env.SUPABASE_BUCKETNAME || "";
    if (!bucketName) {
      return SendErrorResponse(res, 500, "Storage bucket is not configured.");
    }

    // Function to upload files to Supabase and return the public URL
    const uploadFile = async (file: Express.Multer.File, path: string) => {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(path, file.buffer, {
          contentType: file.mimetype,
          upsert: true, // Overwrites the file if it already exists
        });

      if (error) {
        console.error("Supabase upload error:", error);
        throw new Error("Failed to upload image.");
      }

      // Get the full public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(path);

      return publicUrlData.publicUrl;
    };

    // Generate unique file paths
    const timestamp = Date.now();
    const backgroundPath = `background-${timestamp}-${backgroundFile.originalname}`;
    const stickerPath = `sticker-${timestamp}-${stickerFile.originalname}`;

    // Upload files and get URLs
    const backgroundUrl = await uploadFile(backgroundFile, backgroundPath);
    const stickerUrl = await uploadFile(stickerFile, stickerPath);

    // Save template data in MongoDB
    const newTemplate = new TemplateModel({
      backgroundUrl,
      stickerUrl,
      productId,
    });
    await newTemplate.save();

    return sendSuccessResponse(
      res,
      newTemplate,
      "Template uploaded successfully!",
    );
  } catch (error) {
    console.error("File upload error:", error);
    return SendErrorResponse(res, 500, "An error occurred during file upload.");
  }
};
export const getAllTemplates = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const alltemplates = await TemplateModel.find({}).sort({ createdAt: -1 });
    const data = { alltemplates, status: true };
    return sendSuccessResponse(res, data, "");
  } catch (error) {
    console.error("error:", error);
    return SendErrorResponse(res, 500, "An error occurred during getting .");
  }
};
export const deleteTemplate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // const id: string = req.params.id;
    const { id } = req.body;
    if (!id) return SendErrorResponse(res, 400, "Template id missing");

    const isTemplateExist = await TemplateModel.findById(id);
    if (!isTemplateExist)
      return SendErrorResponse(res, 404, "Template not found");

    const bucketName = process.env.SUPABASE_BUCKETNAME || "";
    if (!bucketName) {
      return SendErrorResponse(res, 500, "Storage bucket is not configured.");
    }
    try {
      if (isTemplateExist.backgroundUrl) {
        await supabase.storage
          .from(bucketName)
          .remove([isTemplateExist.backgroundUrl]);
      }
      if (isTemplateExist.stickerUrl) {
        await supabase.storage
          .from(bucketName)
          .remove([isTemplateExist.stickerUrl]);
      }
    } catch (error) {
      console.error("Error deleting templates:", error);
    }

    await TemplateModel.findOneAndDelete({ _id: id });

    return sendSuccessWithoutResponse(res, "Template delete successfully");
  } catch (error) {
    console.error("error:", error);
    return SendErrorResponse(res, 500, "An error occurred during getting .");
  }
};
export const selectedTemplate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { productId, newTemplateId, oldTemplateId } = req.body;

    if (!productId)
      return SendErrorResponse(
        res,
        400,
        "Template ID or Product ID is missing",
      );
    if (oldTemplateId) {
      await TemplateModel.findByIdAndUpdate(
        oldTemplateId,
        { $pull: { productId: productId } },
        { new: true },
      );
    }
    if (newTemplateId) {
      // Step 2: Assign productId to the new template
      const updatedTemplate = await TemplateModel.findByIdAndUpdate(
        newTemplateId,
        { $addToSet: { productId: productId } },
        { new: true },
      );

      if (!updatedTemplate)
        return SendErrorResponse(res, 404, "New template not found");

      return sendSuccessWithoutResponse(res, "Template updated successfully");
    }
    return sendSuccessWithoutResponse(res, "Template updated successfully");
  } catch (error) {
    console.error("Error in selectedTemplate:", error);
    return SendErrorResponse(
      res,
      500,
      "An error occurred while updating the template.",
    );
  }
};
export const getSingleTemplate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id: string = req.params.templateId;

    if (!id) return SendErrorResponse(res, 400, "Template ID is missing");

    const template = await TemplateModel.findById({ _id: id });

    if (!template) return SendErrorResponse(res, 404, "No template found.");

    return sendSuccessResponse(res, template, "Template fetched successfully");
  } catch (error) {
    console.error("Error in fetching template:", error);
    return SendErrorResponse(
      res,
      500,
      "An error occurred while fetching the template",
    );
  }
};
