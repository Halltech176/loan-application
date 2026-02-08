import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
