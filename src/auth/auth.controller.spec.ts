import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticationController } from './auth.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthenticationService } from './auth.service';
import { mockOf } from '../../test/mock-providers';

describe('AuthenticationController', () => {
  let controller: AuthenticationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([])],
      controllers: [AuthenticationController],
      providers: [mockOf(AuthenticationService)],
    }).compile();

    controller = module.get<AuthenticationController>(AuthenticationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
