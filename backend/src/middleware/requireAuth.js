
import { findActiveUserById } from "../services/authService.js";

export async function requireAuth(req, res, next) {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const user = await findActiveUserById(userId);

    if (!user) {
      return req.session.destroy((error) => {
        if (error) {
          return next(error);
        }

        res.clearCookie("naude.sid", {
          path: "/"
        });

        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      });
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}

