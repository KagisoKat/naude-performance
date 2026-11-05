
import { registerSchema } from "../validators/authSchemas.js";
import { registerUser } from "../services/authService.js";
import { loginSchema } from "../validators/authSchemas.js";
import {
  authenticateUser
} from "../services/authService.js";
export async function register(req, res, next) {
  try {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    const user = await registerUser(validation.data);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: user
    });
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
}


export async function login(req, res, next) {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid login data"
      });
    }

    const { email, password } = validation.data;

    const user = await authenticateUser(email, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        return next(error);
      }

      req.session.userId = user.id;

      req.session.save((saveError) => {
        if (saveError) {
          return next(saveError);
        }

        return res.status(200).json({
          success: true,
          message: "Login successful",
          data: user
        });
      });
    });
  } catch (error) {
    next(error);
  }
}

export function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    data: req.user
  });
}

export function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie("naude.sid", {
      path: "/"
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful"
    });
  });
}
