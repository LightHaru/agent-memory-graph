/**
 * Smart entity extraction from text
 * Auto-detects URLs, prices, decisions, dates, and domain entities
 */

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  context?: string;
}

export class EntityExtractor {
  // URL pattern
  private urlPattern = /https?:\/\/[^\s]+/gi;
  
  // Price patterns (USD, VND, crypto)
  private pricePattern = /(?:\$|USD|VND|₫)\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:USD|VND|₫|ETH|BTC|SOL)/gi;
  
  // Decision keywords
  private decisionKeywords = [
    'decided', 'agreed', 'confirmed', 'approved', 'rejected',
    'quyết định', 'đồng ý', 'xác nhận', 'chấp thuận', 'từ chối'
  ];
  
  // Date patterns
  private datePattern = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/g;

  extract(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Extract URLs
    const urls = text.match(this.urlPattern);
    if (urls) {
      urls.forEach(url => {
        entities.push({
          type: 'url',
          value: url,
          confidence: 1.0,
          context: this.getContext(text, url)
        });
      });
    }

    // Extract prices
    const prices = text.match(this.pricePattern);
    if (prices) {
      prices.forEach(price => {
        entities.push({
          type: 'price',
          value: price.trim(),
          confidence: 0.95,
          context: this.getContext(text, price)
        });
      });
    }

    // Extract decisions
    const lowerText = text.toLowerCase();
    for (const keyword of this.decisionKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        const sentences = this.extractSentencesWithKeyword(text, keyword);
        sentences.forEach(sentence => {
          entities.push({
            type: 'decision',
            value: sentence,
            confidence: 0.85,
            context: keyword
          });
        });
      }
    }

    // Extract dates
    const dates = text.match(this.datePattern);
    if (dates) {
      dates.forEach(date => {
        entities.push({
          type: 'date',
          value: date,
          confidence: 0.9,
          context: this.getContext(text, date)
        });
      });
    }

    // Extract mentions (@username, #hashtag)
    const mentions = text.match(/@[\w]+/g);
    if (mentions) {
      mentions.forEach(mention => {
        entities.push({
          type: 'mention',
          value: mention,
          confidence: 1.0
        });
      });
    }

    const hashtags = text.match(/#[\w]+/g);
    if (hashtags) {
      hashtags.forEach(tag => {
        entities.push({
          type: 'hashtag',
          value: tag,
          confidence: 1.0
        });
      });
    }

    return entities;
  }

  private getContext(text: string, target: string, windowSize = 50): string {
    const index = text.indexOf(target);
    if (index === -1) return '';

    const start = Math.max(0, index - windowSize);
    const end = Math.min(text.length, index + target.length + windowSize);
    
    return text.slice(start, end).trim();
  }

  private extractSentencesWithKeyword(text: string, keyword: string): string[] {
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    return sentences.filter(s => 
      s.toLowerCase().includes(keyword.toLowerCase())
    );
  }
}
