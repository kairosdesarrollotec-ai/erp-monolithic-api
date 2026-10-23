import { OutboxEventConsumerRegistry, type OutboxEventConsumer, type OutboxEventEnvelope } from './outbox-event-consumer.registry';

const event = (eventType: string): OutboxEventEnvelope => ({
  id: 'evt-1',
  aggregateType: 'X',
  aggregateId: 'agg-1',
  eventType,
  payload: {},
  createdAt: new Date('2026-10-22T10:00:00Z'),
});

const consumer = (name: string, eventTypes: string[], handle = jest.fn().mockResolvedValue(undefined)): OutboxEventConsumer => ({ name, eventTypes, handle });

describe('OutboxEventConsumerRegistry', () => {
  it('despacha solo a los consumidores que declaran el tipo de evento', async () => {
    const registry = new OutboxEventConsumerRegistry();
    const a = consumer('a', ['RelacionLaboralTerminada.v1']);
    const b = consumer('b', ['PasoAPlanilla.v1']);
    registry.register(a);
    registry.register(b);
    await registry.dispatch(event('RelacionLaboralTerminada.v1'));
    expect(a.handle).toHaveBeenCalledTimes(1);
    expect(b.handle).not.toHaveBeenCalled();
  });

  it('el registro es idempotente por nombre', async () => {
    const registry = new OutboxEventConsumerRegistry();
    const a = consumer('a', ['E']);
    registry.register(a);
    registry.register(consumer('a', ['E']));
    await registry.dispatch(event('E'));
    expect(a.handle).toHaveBeenCalledTimes(1);
  });

  it('si un consumidor falla, intenta los demas y relanza el primer error para que el relay reintente', async () => {
    const registry = new OutboxEventConsumerRegistry();
    const failing = consumer('failing', ['E'], jest.fn().mockRejectedValue(new Error('boom')));
    const ok = consumer('ok', ['E']);
    registry.register(failing);
    registry.register(ok);
    await expect(registry.dispatch(event('E'))).rejects.toThrow('boom');
    expect(ok.handle).toHaveBeenCalledTimes(1);
  });

  it('sin consumidores no hace nada', async () => {
    await expect(new OutboxEventConsumerRegistry().dispatch(event('E'))).resolves.toBeUndefined();
  });
});
