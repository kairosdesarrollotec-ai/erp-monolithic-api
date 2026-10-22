import { FieldTripCascadeScheduler } from './field-trip-cascade.scheduler';
import { ProcessDueFieldTripTimeoutsHandler } from '../../application/commands/process-due-field-trip-timeouts.handler';

/** DEC-OPS-FLAGS-001: el interruptor HR_FIELD_TRIP_CASCADE_SCHEDULER usa el criterio comun (false|off|0|no = apagado, sin distinguir mayusculas). */
describe('FieldTripCascadeScheduler - interruptor HR_FIELD_TRIP_CASCADE_SCHEDULER', () => {
  const saved = { jest: process.env.JEST_WORKER_ID, flag: process.env.HR_FIELD_TRIP_CASCADE_SCHEDULER };
  afterEach(() => {
    if (saved.jest === undefined) delete process.env.JEST_WORKER_ID; else process.env.JEST_WORKER_ID = saved.jest;
    if (saved.flag === undefined) delete process.env.HR_FIELD_TRIP_CASCADE_SCHEDULER; else process.env.HR_FIELD_TRIP_CASCADE_SCHEDULER = saved.flag;
  });

  function init(flag: string | undefined): boolean {
    delete process.env.JEST_WORKER_ID;
    if (flag === undefined) delete process.env.HR_FIELD_TRIP_CASCADE_SCHEDULER; else process.env.HR_FIELD_TRIP_CASCADE_SCHEDULER = flag;
    const scheduler = new FieldTripCascadeScheduler({ execute: jest.fn() } as unknown as ProcessDueFieldTripTimeoutsHandler);
    scheduler.onModuleInit();
    const started = (scheduler as unknown as { timer?: unknown }).timer !== undefined;
    scheduler.onModuleDestroy();
    return started;
  }

  it.each(['off', 'OFF', 'false', 'False', '0', 'no', ' No '])('%p -> no arranca', (v) => {
    expect(init(v)).toBe(false);
  });

  it.each([undefined, '', 'on', 'true', '1', 'yes'])('%p -> arranca (default encendido)', (v) => {
    expect(init(v)).toBe(true);
  });
});
