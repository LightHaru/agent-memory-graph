/**
 * Unit tests for EntityExtractor
 */

import { EntityExtractor } from '../extractor';

describe('EntityExtractor', () => {
  let extractor: EntityExtractor;

  beforeEach(() => {
    extractor = new EntityExtractor();
  });

  describe('URL extraction', () => {
    it('should extract URLs', () => {
      const text = 'Check out https://example.com and http://test.org';
      const entities = extractor.extract(text);

      const urls = entities.filter(e => e.type === 'url');
      expect(urls).toHaveLength(2);
      expect(urls[0].value).toBe('https://example.com');
      expect(urls[1].value).toBe('http://test.org');
    });

    it('should extract URLs with context', () => {
      const text = 'The Pearl OTC deal is at https://pearl.exchange/otc with good rates';
      const entities = extractor.extract(text);

      const url = entities.find(e => e.type === 'url');
      expect(url).toBeDefined();
      expect(url!.context).toContain('Pearl OTC');
    });
  });

  describe('Price extraction', () => {
    it('should extract USD prices', () => {
      const text = 'The price is $1,234.56 or USD 5000';
      const entities = extractor.extract(text);

      const prices = entities.filter(e => e.type === 'price');
      expect(prices.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract VND prices', () => {
      const text = 'Giá là 1,000,000 VND hoặc 500,000₫';
      const entities = extractor.extract(text);

      const prices = entities.filter(e => e.type === 'price');
      expect(prices.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract crypto prices', () => {
      const text = 'Buy 0.5 ETH or 1.2 BTC or 100 SOL';
      const entities = extractor.extract(text);

      const prices = entities.filter(e => e.type === 'price');
      expect(prices.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Decision extraction', () => {
    it('should extract English decisions', () => {
      const text = 'We decided to use PostgreSQL. The team agreed on the timeline.';
      const entities = extractor.extract(text);

      const decisions = entities.filter(e => e.type === 'decision');
      expect(decisions.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract Vietnamese decisions', () => {
      const text = 'Anh quyết định dùng Redis. Team đồng ý với kế hoạch này.';
      const entities = extractor.extract(text);

      const decisions = entities.filter(e => e.type === 'decision');
      expect(decisions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Date extraction', () => {
    it('should extract ISO dates', () => {
      const text = 'Meeting on 2024-12-25 and 2025-01-15';
      const entities = extractor.extract(text);

      const dates = entities.filter(e => e.type === 'date');
      expect(dates).toHaveLength(2);
      expect(dates[0].value).toBe('2024-12-25');
    });

    it('should extract slash dates', () => {
      const text = 'Deadline is 12/25/2024 or 1/15/2025';
      const entities = extractor.extract(text);

      const dates = entities.filter(e => e.type === 'date');
      expect(dates).toHaveLength(2);
    });
  });

  describe('Mention and hashtag extraction', () => {
    it('should extract mentions', () => {
      const text = 'Hey @alice and @bob, check this out';
      const entities = extractor.extract(text);

      const mentions = entities.filter(e => e.type === 'mention');
      expect(mentions).toHaveLength(2);
      expect(mentions[0].value).toBe('@alice');
      expect(mentions[1].value).toBe('@bob');
    });

    it('should extract hashtags', () => {
      const text = 'Great project! #blockchain #web3 #defi';
      const entities = extractor.extract(text);

      const hashtags = entities.filter(e => e.type === 'hashtag');
      expect(hashtags).toHaveLength(3);
      expect(hashtags[0].value).toBe('#blockchain');
    });
  });

  describe('Complex text extraction', () => {
    it('should extract multiple entity types', () => {
      const text = `
        We decided to buy 0.5 ETH at https://pearl.exchange/otc on 2024-12-25.
        Contact @alice for details. #crypto #trading
        Price was $1,500 USD.
      `;

      const entities = extractor.extract(text);

      expect(entities.filter(e => e.type === 'decision').length).toBeGreaterThan(0);
      expect(entities.filter(e => e.type === 'price').length).toBeGreaterThan(0);
      expect(entities.filter(e => e.type === 'url').length).toBeGreaterThan(0);
      expect(entities.filter(e => e.type === 'date').length).toBeGreaterThan(0);
      expect(entities.filter(e => e.type === 'mention').length).toBeGreaterThan(0);
      expect(entities.filter(e => e.type === 'hashtag').length).toBeGreaterThan(0);
    });
  });
});
