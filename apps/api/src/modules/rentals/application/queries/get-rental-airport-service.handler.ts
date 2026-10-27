import { Injectable, NotFoundException } from '@nestjs/common';
import { AirportServiceRepositoryPort } from '../../../reservations/application/ports/airport-service-repository.port';
import { AirportServiceRecord } from '../../../reservations/domain/airport-service';
import { GetRentalAirportServiceQuery } from './get-rental-airport-service.query';

@Injectable()
export class GetRentalAirportServiceHandler {
  constructor(private readonly airportServices: AirportServiceRepositoryPort) {}

  async execute(query: GetRentalAirportServiceQuery): Promise<AirportServiceRecord> {
    const record = await this.airportServices.findByTarget('RENTAL', query.rentalId);
    if (!record) {
      throw new NotFoundException(`No existe servicio de aeropuerto para el alquiler ${query.rentalId}.`);
    }
    return record;
  }
}
