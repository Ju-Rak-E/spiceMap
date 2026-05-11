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

// 행정동 코드(adm_cd) 5자리 접두사 → 자치구 이름 (API 응답 필터링용)
export const SEOUL_DISTRICT_ADM_PREFIX: Record<string, string> = {
  '11110': '종로구',
  '11140': '중구',
  '11170': '용산구',
  '11200': '성동구',
  '11215': '광진구',
  '11230': '동대문구',
  '11260': '중랑구',
  '11290': '성북구',
  '11305': '강북구',
  '11320': '도봉구',
  '11350': '노원구',
  '11380': '은평구',
  '11410': '서대문구',
  '11440': '마포구',
  '11470': '양천구',
  '11500': '강서구',
  '11530': '구로구',
  '11545': '금천구',
  '11560': '영등포구',
  '11590': '동작구',
  '11620': '관악구',
  '11650': '서초구',
  '11680': '강남구',
  '11710': '송파구',
  '11740': '강동구',
}

// 자치구 이름 → adm_cd 5자리 접두사 (역방향)
export const SEOUL_DISTRICT_NAME_TO_ADM_PREFIX = Object.fromEntries(
  Object.entries(SEOUL_DISTRICT_ADM_PREFIX).map(([prefix, name]) => [name, prefix]),
) as Record<string, string>
