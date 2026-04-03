export interface IBaseService<T, CreateDto, UpdateDto> {
  findAll(): Promise<T[]>;
  findOne(id: number): Promise<T>;
  create(dto: CreateDto): Promise<T>;
  update(id: number, dto: UpdateDto): Promise<T>;
  remove(id: number): Promise<void>;
}
