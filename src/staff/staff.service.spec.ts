import { Test, TestingModule } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { serviceDeps } from '../../test/mock-providers';

describe('StaffService', () => {
  let service: StaffService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StaffService, ...serviceDeps],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
