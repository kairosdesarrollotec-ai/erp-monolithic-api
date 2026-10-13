import { GcsCandidateCvService } from './gcs-candidate-cv.service';

const COMPANY = '11111111-1111-4111-8111-111111111111';
const CANDIDATE = '22222222-2222-4222-8222-222222222222';
const OBJECT_ID = '0b9f2a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const PREFIX = 'https://storage.googleapis.com/test-bucket/';

describe('GcsCandidateCvService.isOwnedObjectUrl', () => {
  const previous = { ...process.env };

  beforeAll(() => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    process.env.GCS_CLIENT_EMAIL = 'svc@example.iam.gserviceaccount.com';
    process.env.GCS_PRIVATE_KEY = 'not-a-real-key';
    process.env.FIREBASE_PROJECT_ID = 'proj';
  });

  afterAll(() => {
    process.env = previous;
  });

  const scope = { companyId: COMPANY, candidateId: CANDIDATE };

  it('acepta solo objetos generados bajo candidate-cvs/{empresa}/{candidato}/', () => {
    const service = new GcsCandidateCvService();
    expect(service.isOwnedObjectUrl(`${PREFIX}candidate-cvs/${COMPANY}/${CANDIDATE}/${OBJECT_ID}.pdf`, scope)).toBe(true);
    expect(service.isOwnedObjectUrl(`${PREFIX}candidate-cvs/${COMPANY}/${CANDIDATE}/${OBJECT_ID}.docx`, scope)).toBe(true);
  });

  it.each([
    ['otra empresa', `${PREFIX}candidate-cvs/99999999-9999-4999-8999-999999999999/${CANDIDATE}/${OBJECT_ID}.pdf`],
    ['otro candidato', `${PREFIX}candidate-cvs/${COMPANY}/99999999-9999-4999-8999-999999999999/${OBJECT_ID}.pdf`],
    ['otro bucket', `https://storage.googleapis.com/other-bucket/candidate-cvs/${COMPANY}/${CANDIDATE}/${OBJECT_ID}.pdf`],
    ['otro dominio', `https://evil.example/candidate-cvs/${COMPANY}/${CANDIDATE}/${OBJECT_ID}.pdf`],
    ['otro prefijo (fotos de flota)', `${PREFIX}vehicle-photos/${COMPANY}/${OBJECT_ID}.jpg`],
    ['extension no permitida', `${PREFIX}candidate-cvs/${COMPANY}/${CANDIDATE}/${OBJECT_ID}.exe`],
    ['recorrido de directorio', `${PREFIX}candidate-cvs/${COMPANY}/${CANDIDATE}/../${OBJECT_ID}.pdf`],
    ['nombre no UUID', `${PREFIX}candidate-cvs/${COMPANY}/${CANDIDATE}/cv.pdf`],
  ])('rechaza %s', (_label, url) => {
    const service = new GcsCandidateCvService();
    expect(service.isOwnedObjectUrl(url, scope)).toBe(false);
  });

  it('sin almacenamiento configurado nada es propio', () => {
    delete process.env.GCS_BUCKET_NAME;
    const service = new GcsCandidateCvService();
    expect(service.isOwnedObjectUrl(`${PREFIX}candidate-cvs/${COMPANY}/${CANDIDATE}/${OBJECT_ID}.pdf`, scope)).toBe(false);
    process.env.GCS_BUCKET_NAME = 'test-bucket';
  });
});
