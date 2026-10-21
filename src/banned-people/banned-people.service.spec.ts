import { Test, TestingModule } from '@nestjs/testing';
import { BannedPeopleService } from './banned-people.service';
import { serviceDeps } from '../../test/mock-providers';

describe('BannedPeopleService', () => {
  let service: BannedPeopleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BannedPeopleService, ...serviceDeps],
    }).compile();

    service = module.get<BannedPeopleService>(BannedPeopleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
