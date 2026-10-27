import { Injectable, NotFoundException } from '@nestjs/common';
import { AirportServiceRepositoryPort } from '../ports/airport-service-repository.port';
import { AirportServiceRecord } from '../../domain/airport-service';
import { GetReservationAirportServiceQuery } from './get-reservation-airport-service.query';

@Injectable()
export class GetReservationAirportServiceHandler {
  constructor(private readonly airportServices: AirportServiceRepositoryPort) {}

  async execute(query: GetReservationAirportServiceQuery): Promise<AirportServiceRecord> {
    const record = await this.airportServices.findByTarget('RESERVATION', query.reservationId);
    if (!record) {
      throw new NotFoundException(`No existe servicio de aeropuerto para la reserva ${query.reservationId}.`);
    }
    return record;
  }
}
