import { NotFoundException } from '@nestjs/common';

export class EntityNotFoundException extends NotFoundException {
  constructor(entity: string, id: number | string) {
    super(`${entity} com id ${id} não encontrado(a).`);
  }
}
