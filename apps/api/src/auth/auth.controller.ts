import { Body, Controller, Get, Headers, Inject, Post } from "@nestjs/common";
import { AppDataService } from "../data/app-data.service.js";

@Controller("api/auth")
export class AuthController {
  constructor(@Inject(AppDataService) private readonly data: AppDataService) {}

  @Post("login")
  login(@Body() body: { email: string; password: string }) {
    return this.data.login(body.email, body.password);
  }

  @Post("logout")
  logout(@Headers("authorization") authHeader?: string) {
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim() || "";
    return this.data.logout(token);
  }

  @Get("refresh")
  refresh(@Headers("authorization") authHeader?: string) {
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim() || "";
    return this.data.refresh(token);
  }

  @Post("invite/accept")
  acceptInvite(@Body() body: { token: string; password: string; name?: string }) {
    return this.data.acceptInvite(body.token, body.password, body.name);
  }

  @Post("password/request")
  requestReset(@Body() body: { email: string }) {
    return this.data.requestReset(body.email);
  }

  @Post("password/reset")
  confirmReset(@Body() body: { token: string; password: string }) {
    return this.data.confirmReset(body.token, body.password);
  }
}
