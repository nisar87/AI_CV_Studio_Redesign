import { describe, expect, it } from 'vitest';
import { buildSource, derivedYears, guardText } from './guard';

const check = (source: string[], output: string, extra: number[] = []) =>
  guardText(output, buildSource(source, extra));

describe('truth guard', () => {
  it('leaves a faithful rephrasing untouched', () => {
    const r = check(
      ['Responsible for delivering parcels to customers', 'Swift Logistics'],
      'Delivered parcels to customers on time for Swift Logistics',
    );
    expect(r.findings).toEqual([]);
    expect(r.text).toBe('Delivered parcels to customers on time for Swift Logistics');
  });

  it('marks invented numbers and keeps supported ones', () => {
    const r = check(
      ['Delivered around 120 parcels a day'],
      'Delivered 120 parcels a day to 40 streets',
    );
    expect(r.text).toBe('Delivered 120 parcels a day to {{?add the real number}} streets');
    expect(r.findings).toEqual([{ kind: 'number', value: '40' }]);
  });

  it('marks invented percentages, money and number words', () => {
    const r = check(
      ['Helped customers at the till'],
      'Raised sales by 15% and handled £2,000 daily while leading a team of five',
    );
    expect(r.text).toBe(
      'Raised sales by {{?add the real number}} and handled £{{?add the real number}} daily while leading a team of {{?add the real number}}',
    );
    expect(r.findings.map((f) => f.kind)).toEqual(['number', 'number', 'number']);
  });

  it('accepts number words the person wrote as digits and vice versa', () => {
    expect(check(['team of five'], 'Led a team of 5').findings).toEqual([]);
    expect(check(['team of 5'], 'Led a team of five').findings).toEqual([]);
  });

  it('marks invented years', () => {
    const r = check(['Joined the school as a teacher'], 'Joined the school in 2016');
    expect(r.text).toBe('Joined the school in {{?add the year}}');
    expect(r.findings).toEqual([{ kind: 'year', value: '2016' }]);
  });

  it('marks invented organisations, including multi-word and sentence-initial names', () => {
    expect(check(['Delivered parcels'], 'Delivered parcels for Royal Mail').text).toBe(
      'Delivered parcels for {{?confirm: Royal Mail}}',
    );
    expect(check(['Delivered parcels'], 'Amazon Flex parcels delivered daily').text).toBe(
      '{{?confirm: Amazon Flex}} parcels delivered daily',
    );
    expect(check(['Cared for patients on wards'], 'Cared for patients on NHS wards').text).toBe(
      'Cared for patients on {{?confirm: NHS}} wards',
    );
  });

  it('does not treat a capitalised verb at the start of a sentence as a name', () => {
    expect(
      check(['planned lessons'], 'Planned engaging lessons. Marked homework').findings,
    ).toEqual([]);
  });

  it('keeps names the person provided, in any letter case', () => {
    expect(
      check(['worked at tesco express'], 'Served customers at Tesco Express').findings,
    ).toEqual([]);
  });

  it('marks invented qualifications and licences', () => {
    const r = check(
      ['Drove forklifts in the warehouse'],
      'Certified forklift operator in the warehouse',
    );
    expect(r.text).toBe('{{?confirm: Certified}} forklift operator in the warehouse');
    expect(r.findings).toEqual([{ kind: 'credential', value: 'Certified' }]);
    expect(check(['Primary teacher'], 'Qualified primary teacher with a PGCE').findings).toEqual([
      { kind: 'credential', value: 'Qualified' },
      { kind: 'credential', value: 'PGCE' },
    ]);
  });

  it('keeps qualifications the person listed', () => {
    expect(check(['PGCE Primary Education'], 'Primary teacher with a PGCE').findings).toEqual([]);
  });

  it('preserves question markers written by the model', () => {
    const r = check(['Delivered parcels'], 'Delivered {{?How many parcels a day?}} parcels');
    expect(r.text).toBe('Delivered {{?How many parcels a day?}} parcels');
    expect(r.findings).toEqual([]);
  });

  it('strips stray braces so markers cannot be forged half-way', () => {
    expect(check(['Delivered parcels'], 'Delivered {{parcels}}').text).toBe('Delivered parcels');
  });

  it('allows years of experience derived from the person’s own dates', () => {
    const now = new Date('2026-11-01');
    const years = derivedYears([{ start: '2015-03', end: '', current: true }], now);
    expect(years).toContain(11);
    expect(check(['Driver'], 'Driver with 11 years of experience', years).findings).toEqual([]);
    expect(check(['Driver'], 'Driver with 20 years of experience', years).findings).toHaveLength(1);
  });
});

describe('truth guard: word families and compounds (live eval false alarms)', () => {
  const src = buildSource([
    'NMC registered nurse (Adult)',
    'AWS Certified Solutions Architect – Professional',
  ]);
  it('accepts a hyphenated compound whose parts are all in the CV', () => {
    expect(guardText('An NMC-registered adult nurse.', src).findings).toEqual([]);
    expect(guardText('A GMC-registered doctor.', src).findings.map((f) => f.value)).toEqual([
      'GMC-registered',
    ]);
  });
  it('accepts a credential word from the same family the person used', () => {
    expect(guardText('I hold the AWS Professional certification.', src).findings).toEqual([]);
    expect(guardText('I hold a degree in computing.', src).findings.map((f) => f.kind)).toEqual([
      'credential',
    ]);
  });
});

describe('truth guard: generic compound endings', () => {
  it('accepts "AWS-based" when AWS is in the CV, but not an unknown name', () => {
    const src = buildSource(['AWS Certified Solutions Architect']);
    expect(guardText('An AWS-based service.', src).findings).toEqual([]);
    expect(guardText('An Azure-based service.', src).findings.map((f) => f.value)).toEqual([
      'Azure-based',
    ]);
  });
});
