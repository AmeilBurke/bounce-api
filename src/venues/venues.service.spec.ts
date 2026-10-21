import { Test, TestingModule } from '@nestjs/testing';
import { VenuesService } from './venues.service';
import { serviceDeps } from '../../test/mock-providers';

describe('VenuesService', () => {
  let service: VenuesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VenuesService, ...serviceDeps],
    }).compile();

    service = module.get<VenuesService>(VenuesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
