import { Controller, Get, Header } from '@nestjs/common';
import { AppService, AppStatus } from './app.service';
import { Public } from './auth/public.decorator';
import { STATUS_PAGE } from './status-page';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Status page that polls /status, so opening the API in a browser shows it running
  @Public()
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getStatusPage(): string {
    return STATUS_PAGE;
  }

  @Public()
  @Get('status')
  @Header('Cache-Control', 'no-store')
  getStatus(): Promise<AppStatus> {
    return this.appService.getStatus();
  }
}
