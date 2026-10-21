import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticationService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { StaffService } from '../staff/staff.service';
import { mockOf } from '../../test/mock-providers';

describe('AuthenticationService', () => {
  let service: AuthenticationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthenticationService, mockOf(StaffService), mockOf(JwtService)],
    }).compile();

    service = module.get<AuthenticationService>(AuthenticationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
