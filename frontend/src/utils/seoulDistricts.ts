export interface SeoulDistrict {
  name: string
  guCode: string
}

export interface SeoulDistrictGroup {
  name: string
  districts: readonly string[]
}

export const SEOUL_DISTRICTS: readonly SeoulDistrict[] = [
  { name: '종로구', guCode: '1101' },
  { name: '중구', guCode: '1102' },
  { name: '용산구', guCode: '1103' },
  { name: '성동구', guCode: '1104' },
  { name: '광진구', guCode: '1105' },
  { name: '동대문구', guCode: '1106' },
  { name: '중랑구', guCode: '1107' },
  { name: '성북구', guCode: '1108' },
  { name: '강북구', guCode: '1109' },
  { name: '도봉구', guCode: '1110' },
  { name: '노원구', guCode: '1111' },
  { name: '은평구', guCode: '1112' },
  { name: '서대문구', guCode: '1113' },
  { name: '마포구', guCode: '1114' },
  { name: '양천구', guCode: '1115' },
  { name: '강서구', guCode: '1116' },
  { name: '구로구', guCode: '1117' },
  { name: '금천구', guCode: '1118' },
  { name: '영등포구', guCode: '1119' },
  { name: '동작구', guCode: '1120' },
  { name: '관악구', guCode: '1121' },
  { name: '서초구', guCode: '1122' },
  { name: '강남구', guCode: '1123' },
  { name: '송파구', guCode: '1124' },
  { name: '강동구', guCode: '1125' },
]

export const SEOUL_DISTRICT_GROUPS: readonly SeoulDistrictGroup[] = [
  { name: '도심권', districts: ['종로구', '중구', '용산구'] },
  { name: '동북권', districts: ['성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구'] },
  { name: '서북권', districts: ['은평구', '서대문구', '마포구'] },
  { name: '서남권', districts: ['양천구', '강서구', '구로구', '금천구', '영등포구', '동작구', '관악구'] },
  { name: '동남권', districts: ['서초구', '강남구', '송파구', '강동구'] },
]

export const SEOUL_DISTRICT_NAMES = SEOUL_DISTRICTS.map((district) => district.name)

export const SEOUL_DISTRICT_CODE_BY_NAME = Object.fromEntries(
  SEOUL_DISTRICTS.map((district) => [district.name, district.guCode]),
) as Record<string, string>

const STANDARD_SIGUNGU_PREFIX_BY_LEGACY_CODE: Record<string, string> = {
  '1101': '11110',
  '1102': '11140',
  '1103': '11170',
  '1104': '11200',
  '1105': '11215',
  '1106': '11230',
  '1107': '11260',
  '1108': '11290',
  '1109': '11305',
  '1110': '11320',
  '1111': '11350',
  '1112': '11380',
  '1113': '11410',
  '1114': '11440',
  '1115': '11470',
  '1116': '11500',
  '1117': '11530',
  '1118': '11545',
  '1119': '11560',
  '1120': '11590',
  '1121': '11620',
  '1122': '11650',
  '1123': '11680',
  '1124': '11710',
  '1125': '11740',
}

export const SEOUL_DISTRICT_NAME_TO_ADM_PREFIX = Object.fromEntries(
  SEOUL_DISTRICTS.map((district) => [
    district.name,
    STANDARD_SIGUNGU_PREFIX_BY_LEGACY_CODE[district.guCode] ?? district.guCode,
  ]),
) as Record<string, string>
