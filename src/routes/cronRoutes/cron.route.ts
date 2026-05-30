import { Router, Request, Response } from "express";
import { fetchEmails, debugEmailFlow } from "../../controllers/email.controller";

const router = Router();

// Protected cron endpoint — called by external cron service every 4 minutes
router.post("/fetch-emails", async (req: Request, res: Response) => {
  const secret = req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    console.log("⏰ Cron triggered: fetchEmails");
    fetchEmails(); // fire and forget — don't await (IMAP takes time)
    res.status(200).json({ status: "ok", message: "fetchEmails triggered" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint — runs email flow and returns detailed logs
router.post("/debug-emails", async (req: Request, res: Response) => {
  const secret = req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await debugEmailFlow();
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
