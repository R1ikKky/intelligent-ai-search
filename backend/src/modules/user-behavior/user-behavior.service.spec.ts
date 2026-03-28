import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserBehaviorService } from './user-behavior.service';
import { UserBehaviorEvent, EventType, EVENT_WEIGHTS } from './entities/user-behavior-event.entity';
import { UserProductScore } from './entities/user-product-score.entity';

const mockEventRepo = () => ({
  save: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
});

const mockScoreRepo = () => ({
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('UserBehaviorService', () => {
  let service: UserBehaviorService;
  let eventRepo: ReturnType<typeof mockEventRepo>;
  let scoreRepo: ReturnType<typeof mockScoreRepo>;

  beforeEach(async () => {
    eventRepo = mockEventRepo();
    scoreRepo = mockScoreRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserBehaviorService,
        { provide: getRepositoryToken(UserBehaviorEvent), useValue: eventRepo },
        { provide: getRepositoryToken(UserProductScore), useValue: scoreRepo },
      ],
    }).compile();

    service = module.get<UserBehaviorService>(UserBehaviorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordEvent', () => {
    it('should save event with correct weight for ORDER', async () => {
      eventRepo.create.mockReturnValue({ userId: 'u1', productId: 'p1', eventType: EventType.ORDER, weight: 10 });
      eventRepo.save.mockResolvedValue({});

      await service.recordEvent('u1', 'p1', EventType.ORDER);

      expect(eventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ weight: EVENT_WEIGHTS[EventType.ORDER] }),
      );
      expect(eventRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should save event with correct weight for VIEW', async () => {
      eventRepo.create.mockReturnValue({ weight: 1 });
      eventRepo.save.mockResolvedValue({});

      await service.recordEvent('u1', 'p1', EventType.VIEW);

      expect(eventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ weight: EVENT_WEIGHTS[EventType.VIEW] }),
      );
    });

    it('should save event with correct weight for BOOKMARK', async () => {
      eventRepo.create.mockReturnValue({ weight: 5 });
      eventRepo.save.mockResolvedValue({});

      await service.recordEvent('u1', 'p1', EventType.BOOKMARK);

      expect(eventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ weight: EVENT_WEIGHTS[EventType.BOOKMARK] }),
      );
    });
  });

  describe('getScoreMap', () => {
    it('should return empty map for empty productIds', async () => {
      const result = await service.getScoreMap('user-1', []);
      expect(result.size).toBe(0);
    });

    it('should return score map for given products', async () => {
      scoreRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { productId: 'p1', score: 15, userId: 'u1' },
          { productId: 'p2', score: 30, userId: 'u1' },
        ]),
      });

      const result = await service.getScoreMap('u1', ['p1', 'p2']);
      expect(result.get('p1')).toBe(15);
      expect(result.get('p2')).toBe(30);
    });
  });

  describe('getScoresForUser', () => {
    it('should return sorted scores for user', async () => {
      const mockScores: UserProductScore[] = [
        { userId: 'u1', productId: 'p1', score: 50, lastUpdated: new Date() },
        { userId: 'u1', productId: 'p2', score: 20, lastUpdated: new Date() },
      ];
      scoreRepo.find.mockResolvedValue(mockScores);

      const result = await service.getScoresForUser('u1');
      expect(result).toEqual(mockScores);
      expect(scoreRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
    });
  });

  describe('event weights', () => {
    it('should have correct weight values', () => {
      expect(EVENT_WEIGHTS[EventType.ORDER]).toBe(10);
      expect(EVENT_WEIGHTS[EventType.BOOKMARK]).toBe(5);
      expect(EVENT_WEIGHTS[EventType.CLICK]).toBe(2);
      expect(EVENT_WEIGHTS[EventType.VIEW]).toBe(1);
    });
  });
});
