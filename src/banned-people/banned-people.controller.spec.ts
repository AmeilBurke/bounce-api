import { Test, TestingModule } from '@nestjs/testing';
import { BannedPeopleController } from './banned-people.controller';
import { BannedPeopleService } from './banned-people.service';

describe('BannedPeopleController', () => {
  let controller: BannedPeopleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BannedPeopleController],
      providers: [BannedPeopleService],
    }).compile();

    controller = module.get<BannedPeopleController>(BannedPeopleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
