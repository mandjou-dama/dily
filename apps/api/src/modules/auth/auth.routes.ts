import {
  logoutBodySchema,
  otpRequestBodySchema,
  otpVerifyBodySchema,
  refreshBodySchema,
} from "@dily/shared";
import type { FastifyPluginAsync } from "fastify";
import { parseInput } from "../../lib/validation.js";
import type { AuthService } from "./auth.service.js";

export interface AuthRoutesOptions {
  auth: AuthService;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  { auth },
) => {
  app.post("/auth/otp/request", async (request, reply) => {
    const { phone } = parseInput(otpRequestBodySchema, request.body);
    await auth.requestOtp(phone, request.ip);
    return reply.code(204).send();
  });

  app.post("/auth/otp/verify", async (request) => {
    const { phone, code, deviceId } = parseInput(
      otpVerifyBodySchema,
      request.body,
    );
    return auth.verifyOtp(phone, code, deviceId, request.ip);
  });

  app.post("/auth/refresh", async (request) => {
    const { refreshToken } = parseInput(refreshBodySchema, request.body);
    return auth.refresh(refreshToken);
  });

  app.post("/auth/logout", async (request, reply) => {
    const { refreshToken } = parseInput(logoutBodySchema, request.body);
    await auth.logout(refreshToken);
    return reply.code(204).send();
  });
};
