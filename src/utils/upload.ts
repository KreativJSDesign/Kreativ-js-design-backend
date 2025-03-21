import multer from "multer";

const storage = multer.memoryStorage(); // Store files in memory before uploading

const upload = multer({
  storage,
}).fields([
  { name: "background", maxCount: 1 },
  { name: "sticker", maxCount: 1 },
  { name: "productId", maxCount: 1 },
]);

export default upload;
