import { Test, TestingModule } from '@nestjs/testing';
import { AlertsService } from './alerts.service';
import { serviceDeps } from '../../test/mock-providers';

describe('AlertsService', () => {
  let service: AlertsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AlertsService, ...serviceDeps],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
