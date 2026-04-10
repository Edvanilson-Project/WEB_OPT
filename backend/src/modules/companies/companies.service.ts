import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyEntity } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { EntityNotFoundException } from '../../common/exceptions/not-found.exception';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
  ) {}

  async create(dto: CreateCompanyDto): Promise<CompanyEntity> {
    const exists = await this.companyRepo.findOne({
      where: { cnpj: dto.cnpj },
    });
    if (exists) throw new ConflictException(`CNPJ ${dto.cnpj} já cadastrado.`);
    const company = this.companyRepo.create(dto);
    return this.companyRepo.save(company);
  }

  async findAll(): Promise<CompanyEntity[]> {
    return this.companyRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<CompanyEntity> {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new EntityNotFoundException('Empresa', id);
    return company;
  }

  async update(
    id: number,
    dto: Partial<CreateCompanyDto>,
  ): Promise<CompanyEntity> {
    const company = await this.findOne(id);
    if (dto.cnpj && dto.cnpj !== company.cnpj) {
      const dup = await this.companyRepo.findOne({ where: { cnpj: dto.cnpj } });
      if (dup && dup.id !== id)
        throw new ConflictException(`CNPJ ${dto.cnpj} já cadastrado.`);
    }
    Object.assign(company, dto);
    return this.companyRepo.save(company);
  }

  async remove(id: number): Promise<void> {
    const company = await this.findOne(id);
    await this.companyRepo.remove(company);
  }
}
