// 전역 변수 및 상수 선언
const STORAGE_KEY = 'travelMapData';
let map;
let travelData = {
    visited: [],
    wishlist: []
};
let countryLabels = {}; // 국가 레이블을 저장할 객체
let totalCountries = 0; // 전체 국가 수를 저장할 변수

// 전역 변수로 정보 창 추가
let infoWindow;

// 전역 변수에 추가
let continents = {};

// 전역 변수에 추가
let travelPlans = [];

let selectedCountry = null;

// 전역 변수에 추가
let currentLanguage = 'ko';
let translations = {};

// 언어 파일 로드 함수
async function loadLanguage(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        translations = await response.json();
        currentLanguage = lang;
        // DOM이 로드된 후에 UI 업데이트를 수행합니다.
        if (document.readyState === 'complete') {
            updateUILanguage();
        } else {
            window.addEventListener('load', updateUILanguage);
        }
    } catch (error) {
        console.error('Error loading language file:', error);
    }
}

// UI 언어 업데이트 함수
function updateUILanguage() {
    document.title = translations.title;

    const elements = {
        'toggle-stats': translations.travelStats,
        'toggle-plan': translations.travelPlan,
        'toggle-visited-list': translations.showVisitedList,
        'save-date': translations.save,
        'cancel-date': translations.cancel
    };

    for (const [id, text] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }

    const selectors = {
        '#info-panel h2': translations.travelStats,
        '#travel-plan h2': translations.travelPlan,
        '.stat-label:nth-child(1)': translations.totalCountries,
        '.stat-label:nth-child(2)': translations.visitedCountries,
        '.stat-label:nth-child(3)': translations.wishlistCountries,
        '#date-modal h3': translations.selectTravelDate,
        '#loginForm button': translations.login
    };

    for (const [selector, text] of Object.entries(selectors)) {
        const element = document.querySelector(selector);
        if (element) element.textContent = text;
    }

    const continentFilter = document.getElementById('continent-filter');
    if (continentFilter) {
        const continents = [
            translations.allContinents,
            translations.africa,
            translations.asia,
            translations.europe,
            translations.northAmerica,
            translations.southAmerica,
            translations.oceania,
            translations.antarctica
        ];
        continents.forEach((continent, index) => {
            if (continentFilter.options[index]) {
                continentFilter.options[index].textContent = continent;
            }
        });
    }

    const emailInput = document.querySelector('#loginForm input[type="email"]');
    if (emailInput) emailInput.placeholder = translations.email;

    const passwordInput = document.querySelector('#loginForm input[type="password"]');
    if (passwordInput) passwordInput.placeholder = translations.password;
}

// 초기화 함수 수정
async function initMap() {
    await loadLanguage('ko'); // 기본 언어를 한국어로 설정
    loadData(); // 초기화 시 저장된 데이터 불러오기

    // Google Maps API가 로드된 후에 실행
    if (typeof google === 'undefined') {
        console.error('Google Maps API not loaded');
        return;
    }

    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 3,
        center: { lat: 0, lng: 0 },
        styles: [
            {
                featureType: 'all',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });

    loadGeoJson();
    initUI();

    // 화면 크기에 따라 지도 중심 조정
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    if (mediaQuery.matches) {
        map.setCenter({ lat: 30, lng: 0 }); // 모바일에서는 더 은 뷰
        map.setZoom(1);
    }

    loadTravelPlans();

    // 국가 클릭 이벤트 리스너 추가
    map.data.addListener('click', function (event) {
        const countryCode = event.feature.getProperty('ISO_A2');
        toggleCountryStatus(countryCode);
    });

    // 지도 클릭 시 모든 카드 닫기
    map.addListener('click', function () {
        document.getElementById('travel-plan').classList.add('hidden');
        document.getElementById('info-panel').classList.add('hidden');
    });
}

// GeoJSON 데이터 로드 함수
function loadGeoJson() {
    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
        .then(response => response.json())
        .then(data => {
            map.data.addGeoJson(data);

            totalCountries = data.features.length;
            updateTravelInfo();
            setMapStyle(); // 여기에 추가
            data.features.forEach(feature => {
                const countryCode = feature.properties.ISO_A2;
                const countryName = feature.properties.ADMIN;
                const continent = getContinent(feature.properties);

                // console.log(`Country: ${countryName}, Code: ${countryCode}, Continent: ${continent}`);

                if (!continents[continent]) {
                    continents[continent] = [];
                }
                continents[continent].push(countryCode);

                // 국가의 중심점 계산
                let centerLat, centerLng;
                if (feature.geometry.type === "Polygon") {
                    const coordinates = feature.geometry.coordinates[0];
                    const bounds = new google.maps.LatLngBounds();
                    coordinates.forEach(coord => {
                        bounds.extend(new google.maps.LatLng(coord[1], coord[0]));
                    });
                    const center = bounds.getCenter();
                    centerLat = center.lat();
                    centerLng = center.lng();
                } else if (feature.geometry.type === "MultiPolygon") {
                    // 가장 큰 폴리곤의 중심점 사용
                    let maxArea = 0;
                    let maxAreaCenter;
                    feature.geometry.coordinates.forEach(polygon => {
                        const bounds = new google.maps.LatLngBounds();
                        polygon[0].forEach(coord => {
                            bounds.extend(new google.maps.LatLng(coord[1], coord[0]));
                        });
                        const area = Math.abs(bounds.getNorthEast().lat() - bounds.getSouthWest().lat()) *
                            Math.abs(bounds.getNorthEast().lng() - bounds.getSouthWest().lng());
                        if (area > maxArea) {
                            maxArea = area;
                            maxAreaCenter = bounds.getCenter();
                        }
                    });
                    centerLat = maxAreaCenter.lat();
                    centerLng = maxAreaCenter.lng();
                }

                // 국가 코드 레이블 추가
                const label = new google.maps.Marker({
                    position: { lat: centerLat, lng: centerLng },
                    map: map,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 0
                    },
                    label: {
                        text: countryCode,
                        color: "#000000",
                        fontSize: "10px",
                        fontWeight: "bold"
                    }
                });

                // 레이블을 countryLabels 객체에 저장
                countryLabels[countryCode] = {
                    marker: label,
                    code: countryCode,
                    name: countryName
                };
            });

            // console.log('Continents object:', continents);

            setMapStyle();
            addMapListeners();
            updateTravelInfo();
        })
        .catch(error => console.error('Error loading GeoJSON:', error));
}

// 대륙을 결정하는 함수를 추가합니다
function getContinent(properties) {
    const countryCode = properties.ISO_A2;
    const continent = countryToContinent[countryCode] || 'Unknown';
    // console.log(`Country: ${properties.ADMIN}, Code: ${countryCode}, Continent: ${continent}`);
    return continent;
}

// 지도 타일 설 함수
function setMapStyle() {
    map.data.setStyle(function (feature) {
        const countryCode = feature.getProperty('ISO_A2');
        if (travelData.visited.includes(countryCode)) {
            return {
                fillColor: 'green',
                fillOpacity: 0.6,
                strokeWeight: 1
            };
        } else if (travelData.wishlist.includes(countryCode)) {
            return {
                fillColor: 'yellow',
                fillOpacity: 0.6,
                strokeWeight: 1
            };
        } else {
            return {
                fillColor: null,  // 클릭 전 상태는 색상을 지정하지 않음
                fillOpacity: 0,
                strokeWeight: 1
            };
        }
    });
}

// 지도 이벤트 리스너 추가 함수
function addMapListeners() {
    // 정보 창 초기화
    infoWindow = new google.maps.InfoWindow();

    map.data.addListener('click', function (event) {
        const countryCode = event.feature.getProperty('ISO_A2');
        toggleCountryStatus(countryCode);
    });

    // 마우스 오버 효과 추가
    map.data.addListener('mouseover', function (event) {
        const countryCode = event.feature.getProperty('ISO_A2');
        const label = countryLabels[countryCode];
        if (label) {
            label.marker.setLabel({
                text: label.name,
                color: "#000000",
                fontSize: "14px",  // 폰트 크기를 키웁니다
                fontWeight: "bold"
            });
        }
        map.data.overrideStyle(event.feature, {
            fillOpacity: 0.8,
            strokeWeight: 2,
            strokeColor: '#000000'
        });
    });

    // 마우스 아웃 효과 추가
    map.data.addListener('mouseout', function (event) {
        const countryCode = event.feature.getProperty('ISO_A2');
        const label = countryLabels[countryCode];
        if (label) {
            label.marker.setLabel({
                text: label.code,
                color: "#000000",
                fontSize: "8px",  // 원래 크기로 니다
                fontWeight: "bold"
            });
        }
        map.data.revertStyle();
    });
}

// 국가 상태 토글 함수
function toggleCountryStatus(countryCode) {
    if (travelData.visited.includes(countryCode)) {
        // 방문한 국가에서 가고 싶은 국가로
        travelData.visited = travelData.visited.filter(code => code !== countryCode);
        travelData.wishlist.push(countryCode);
    } else if (travelData.wishlist.includes(countryCode)) {
        // 가고 싶은 국가에서 클릭 전 상태로
        travelData.wishlist = travelData.wishlist.filter(code => code !== countryCode);
    } else {
        // 클릭 전 상태에서 방문한 국가로
        travelData.visited.push(countryCode);
    }

    setMapStyle();
    updateTravelInfo();
    saveData();

    console.log('Country status toggled:', countryCode);
}

// 여행 정보 업데이트 함수
function updateTravelInfo() {
    document.getElementById('total-countries').textContent = totalCountries;
    document.getElementById('visited-count').textContent = travelData.visited.length;
    document.getElementById('wishlist-count').textContent = travelData.wishlist.length;

    // 방문한 국가 비율 계산 및 표시
    const visitedPercentage = (travelData.visited.length / totalCountries * 100).toFixed(1);
    document.getElementById('visited-percentage').textContent = `${visitedPercentage}%`;

    const visitedList = document.getElementById('visited-countries-list');
    const continentFilter = document.getElementById('continent-filter');

    function updateVisitedList() {
        visitedList.innerHTML = '';
        const selectedContinent = continentFilter.value;

        const visitedCountries = travelData.visited
            .filter(countryCode => countryLabels[countryCode])
            .sort((a, b) => {
                const nameA = countryLabels[a] ? countryLabels[a].name : a;
                const nameB = countryLabels[b] ? countryLabels[b].name : b;
                return nameA.localeCompare(nameB);
            });

        const groupedCountries = {};
        visitedCountries.forEach(countryCode => {
            const continent = Object.keys(continents).find(c => continents[c].includes(countryCode)) || 'Unknown';
            if (!groupedCountries[continent]) {
                groupedCountries[continent] = [];
            }
            groupedCountries[continent].push(countryCode);
        });

        Object.entries(groupedCountries).forEach(([continent, countries]) => {
            if (selectedContinent === 'all' || selectedContinent === continent) {
                const continentHeader = document.createElement('li');
                continentHeader.className = 'continent-header';
                const totalCountriesInContinent = continents[continent].length;
                const visitedCountriesInContinent = countries.length;
                const visitedPercentageInContinent = (visitedCountriesInContinent / totalCountriesInContinent * 100).toFixed(1);
                continentHeader.textContent = `${continent} (${visitedCountriesInContinent}/${totalCountriesInContinent}, ${visitedPercentageInContinent}%)`;
                visitedList.appendChild(continentHeader);

                countries.forEach(countryCode => {
                    const countryName = countryLabels[countryCode] ? countryLabels[countryCode].name : countryCode;
                    const listItem = document.createElement('li');
                    listItem.textContent = countryName;
                    visitedList.appendChild(listItem);
                });
            }
        });
    }

    updateVisitedList();
    continentFilter.addEventListener('change', updateVisitedList);
}

// 국가 이름 표시 함수
function showCountryName(event) {
    const countryName = event.feature.getProperty('ADMIN');
    const countryCode = event.feature.getProperty('ISO_A2');

    // 마우스 서 위치 가져오기
    const geometry = event.feature.getGeometry();
    let center;

    if (geometry.getType() === 'Polygon') {
        center = geometry.getAt(0).getAt(0);
    } else if (geometry.getType() === 'MultiPolygon') {
        center = geometry.getAt(0).getAt(0).getAt(0);
    } else {
        // 다른 지오메트리 타입의 경우 (예: Point)
        center = event.latLng;
    }

    infoWindow.setContent(`<div style="font-weight: bold;">${countryName} (${countryCode})</div>`);
    infoWindow.setPosition(center);
    infoWindow.open(map);
}
// UI 초기화 함수
function initUI() {
    const toggleButton = document.getElementById('toggle-visited-list');
    const visitedCountriesContainer = document.getElementById('visited-countries-container');

    toggleButton.addEventListener('click', function () {
        if (visitedCountriesContainer.classList.contains('hidden')) {
            visitedCountriesContainer.classList.remove('hidden');
            toggleButton.textContent = '방문한 국가 목록 숨기기';
        } else {
            visitedCountriesContainer.classList.add('hidden');
            toggleButton.textContent = '방문한 국가 목록 기';
        }
    });

    const continentFilter = document.getElementById('continent-filter');
    continentFilter.addEventListener('change', updateTravelInfo);

    const shareButton = document.getElementById('share-button');
    if (shareButton) {
        shareButton.addEventListener('click', shareMap);
    }

    initShareFeatures();

    console.log('UI initialized');
}
// Google Maps API 로드 완료 후 initMap 함수 호출
window.initMap = initMap;

// 페이지 로드 완료 후 initMap 함수 수동 호출 (디버깅용)
window.onload = function () {
    console.log("페이지 로드가 완료되었습니다.");
    if (typeof google === 'object' && typeof google.maps === 'object') {
        initMap();
    } else {
        console.error("Google Maps API가 로드되지 않았습니다.");
    }
};

// 데이터 저장 함수
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(travelData));
}

// 데이터 불러오기 함수
function loadData() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        travelData = JSON.parse(savedData);
    }
}

function resetData() {
    travelData = {
        visited: [],
        wishlist: []
    };
    saveData();
    setMapStyle();
    updateTravelInfo();
}
const countryToContinent = {
    // Africa
    'DZ': 'Africa', 'AO': 'Africa', 'BJ': 'Africa', 'BW': 'Africa', 'BF': 'Africa', 'BI': 'Africa', 'CM': 'Africa', 'CV': 'Africa', 'CF': 'Africa', 'TD': 'Africa', 'KM': 'Africa', 'CI': 'Africa', 'DJ': 'Africa', 'EG': 'Africa', 'GQ': 'Africa', 'ER': 'Africa', 'ET': 'Africa', 'GA': 'Africa', 'GM': 'Africa', 'GH': 'Africa', 'GN': 'Africa', 'GW': 'Africa', 'KE': 'Africa', 'LS': 'Africa', 'LR': 'Africa', 'LY': 'Africa', 'MG': 'Africa', 'MW': 'Africa', 'ML': 'Africa', 'MR': 'Africa', 'MA': 'Africa', 'MZ': 'Africa', 'NA': 'Africa', 'NE': 'Africa', 'NG': 'Africa', 'RW': 'Africa', 'SN': 'Africa', 'SC': 'Africa', 'SL': 'Africa', 'SO': 'Africa', 'ZA': 'Africa', 'SS': 'Africa', 'SD': 'Africa', 'SZ': 'Africa', 'TZ': 'Africa', 'TG': 'Africa', 'TN': 'Africa', 'UG': 'Africa', 'ZM': 'Africa', 'ZW': 'Africa',
    // Asia
    'AF': 'Asia', 'AM': 'Asia', 'AZ': 'Asia', 'BH': 'Asia', 'BD': 'Asia', 'BT': 'Asia', 'BN': 'Asia', 'KH': 'Asia', 'CN': 'Asia', 'CY': 'Asia', 'GE': 'Asia', 'IN': 'Asia', 'ID': 'Asia', 'IR': 'Asia', 'IQ': 'Asia', 'IL': 'Asia', 'JP': 'Asia', 'JO': 'Asia', 'KZ': 'Asia', 'KW': 'Asia', 'KG': 'Asia', 'LA': 'Asia', 'LB': 'Asia', 'MY': 'Asia', 'MV': 'Asia', 'MN': 'Asia', 'MM': 'Asia', 'NP': 'Asia', 'KP': 'Asia', 'OM': 'Asia', 'PK': 'Asia', 'PS': 'Asia', 'PH': 'Asia', 'QA': 'Asia', 'SA': 'Asia', 'SG': 'Asia', 'KR': 'Asia', 'LK': 'Asia', 'SY': 'Asia', 'TW': 'Asia', 'TJ': 'Asia', 'TH': 'Asia', 'TL': 'Asia', 'TR': 'Asia', 'TM': 'Asia', 'AE': 'Asia', 'UZ': 'Asia', 'VN': 'Asia', 'YE': 'Asia',
    // Europe
    'AL': 'Europe', 'AD': 'Europe', 'AT': 'Europe', 'BY': 'Europe', 'BE': 'Europe', 'BA': 'Europe', 'BG': 'Europe', 'HR': 'Europe', 'CZ': 'Europe', 'DK': 'Europe', 'EE': 'Europe', 'FI': 'Europe', 'FR': 'Europe', 'DE': 'Europe', 'GR': 'Europe', 'HU': 'Europe', 'IS': 'Europe', 'IE': 'Europe', 'IT': 'Europe', 'LV': 'Europe', 'LI': 'Europe', 'LT': 'Europe', 'LU': 'Europe', 'MT': 'Europe', 'MD': 'Europe', 'MC': 'Europe', 'ME': 'Europe', 'NL': 'Europe', 'MK': 'Europe', 'NO': 'Europe', 'PL': 'Europe', 'PT': 'Europe', 'RO': 'Europe', 'RU': 'Europe', 'SM': 'Europe', 'RS': 'Europe', 'SK': 'Europe', 'SI': 'Europe', 'ES': 'Europe', 'SE': 'Europe', 'CH': 'Europe', 'UA': 'Europe', 'GB': 'Europe', 'VA': 'Europe',
    // North America
    'AG': 'North America', 'BS': 'North America', 'BB': 'North America', 'BZ': 'North America', 'CA': 'North America', 'CR': 'North America', 'CU': 'North America', 'DM': 'North America', 'DO': 'North America', 'SV': 'North America', 'GD': 'North America', 'GT': 'North America', 'HT': 'North America', 'HN': 'North America', 'JM': 'North America', 'MX': 'North America', 'NI': 'North America', 'PA': 'North America', 'KN': 'North America', 'LC': 'North America', 'VC': 'North America', 'TT': 'North America', 'US': 'North America',
    // South America
    'AR': 'South America', 'BO': 'South America', 'BR': 'South America', 'CL': 'South America', 'CO': 'South America', 'EC': 'South America', 'GY': 'South America', 'PY': 'South America', 'PE': 'South America', 'SR': 'South America', 'UY': 'South America', 'VE': 'South America',
    // Oceania
    'AU': 'Oceania', 'FJ': 'Oceania', 'KI': 'Oceania', 'MH': 'Oceania', 'FM': 'Oceania', 'NR': 'Oceania', 'NZ': 'Oceania', 'PW': 'Oceania', 'PG': 'Oceania', 'WS': 'Oceania', 'SB': 'Oceania', 'TO': 'Oceania', 'TV': 'Oceania', 'VU': 'Oceania',
    // Antarctica
    'AQ': 'Antarctica'
};

async function login(email, password) {
    try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            // 로그인 성공 후 처리 (예: UI 업데이트)
        } else {
            // 에러 처리
            console.error(data.msg);
        }
    } catch (error) {
        console.error('Login error:', error);
    }
}
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            await login(email, password);
        });
    }

    const planForm = document.getElementById('plan-form');
    if (planForm) {
        planForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const countryCode = document.getElementById('plan-country').value.toUpperCase();
            const date = document.getElementById('plan-date').value;
            addTravelPlan(countryCode, date);
            this.reset();
        });
    }
});

// 여행 계획 목록 업데이트 함수
function updateTravelPlanList() {
    const planList = document.getElementById('plan-list');
    planList.innerHTML = '';
    travelData.wishlist.forEach(countryCode => {
        const countryName = countryLabels[countryCode] ? countryLabels[countryCode].name : countryCode;
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${countryName} (${countryCode})</span>
            <button onclick="removeFromWishlist('${countryCode}')">삭제</button>
        `;
        planList.appendChild(li);
    });
}

// 위시리스트에서 국가 제거 함수
function removeFromWishlist(countryCode) {
    travelData.wishlist = travelData.wishlist.filter(code => code !== countryCode);
    setMapStyle();
    updateTravelInfo();
    updateTravelPlanList();
    saveData();
}

// 여행 계획 저장 함수
function saveTravelPlans() {
    localStorage.setItem('travelPlans', JSON.stringify(travelPlans));
}

// 여행 계획 불러오기 함수
function loadTravelPlans() {
    const savedPlans = localStorage.getItem('travelPlans');
    if (savedPlans) {
        travelPlans = JSON.parse(savedPlans);
        updateTravelPlanList();

        // 저장된 계획에 따라 지도 스타일 적용
        travelPlans.forEach(plan => {
            const feature = map.data.getFeatureById(plan.countryCode);
            if (feature) {
                map.data.overrideStyle(feature, { fillColor: '#1a73e8', strokeWeight: 2 });
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const toggleStatsButton = document.getElementById('toggle-stats');
    const togglePlanButton = document.getElementById('toggle-plan');
    const infoPanel = document.getElementById('info-panel');
    const travelPlan = document.getElementById('travel-plan');

    toggleStatsButton.addEventListener('click', function () {
        infoPanel.classList.toggle('hidden');
        if (!infoPanel.classList.contains('hidden')) {
            travelPlan.classList.add('hidden');
        }
    });

    togglePlanButton.addEventListener('click', function () {
        travelPlan.classList.toggle('hidden');
        if (!travelPlan.classList.contains('hidden')) {
            infoPanel.classList.add('hidden');
            updateTravelPlanList(); // 여행 계획 리스트 업데이트
        }
    });

    // 지도 클릭 시 모든 카드 닫기
    if (map) {
        map.addListener('click', function () {
            infoPanel.classList.add('hidden');
            travelPlan.classList.add('hidden');
        });
    } else {
        console.warn('Map is not initialized yet. Event listener for closing cards on map click will not be added.');
    }
});

// 언어 변경 함수
function changeLanguage(lang) {
    loadLanguage(lang);
    document.getElementById('language-dropdown-content').classList.remove('show');
    // 선택된 언어를 버튼 텍스트로 설정
    const languageNames = {
        'en': 'English',
        'ko': '한국어',
        'ja': '日本語'
    };
    document.getElementById('language-dropdown-btn').textContent = languageNames[lang];
}

function shareMap() {
    // 현재 사용자의 여행 데이터를 문자열로 변환
    const shareData = JSON.stringify(travelData);

    // Base64로 인코딩 (URL에 안전하게 전달하기 위해)
    const encodedData = btoa(shareData);

    // 현재 페이지의 URL에 데이터를 쿼리 파라미터로 추가
    const shareUrl = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;

    // 임시 입력 요소를 만들어 URL을 복사
    const tempInput = document.createElement('input');
    tempInput.value = shareUrl;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);

    alert('공유 링크가 클립보드에 복사되었습니다!');
}

function initializeApp() {
    loadData(); // 저장된 데이터 불러오기
    loadSharedData(); // 이 줄을 추가
    loadLanguage(currentLanguage).then(() => {
        if (typeof google !== 'undefined') {
            initMap();
            initUI(); // 이 줄이 있는지 확인하세요
        } else {
            console.error('Google Maps API not loaded');
        }
    });
}

function loadSharedData() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('data');

    if (sharedData) {
        try {
            const decodedData = atob(sharedData);
            const parsedData = JSON.parse(decodedData);
            travelData = parsedData;
            updateTravelInfo();
            setMapStyle();
        } catch (error) {
            console.error('Error loading shared data:', error);
        }
    }
}

// html2canvas 라이브러리 로드
function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        if (window.html2canvas) {
            resolve(window.html2canvas);
        } else {
            const script = document.createElement('script');
            script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
            script.onload = () => resolve(window.html2canvas);
            script.onerror = reject;
            document.head.appendChild(script);
        }
    });
}

// 스크린샷 저장 함수 수정
async function saveScreenshot() {
    const html2canvas = await loadHtml2Canvas();

    // 지도 컨테이너와 통계 카드를 포함하는 새로운 div 생성
    const screenshotContainer = document.createElement('div');
    screenshotContainer.style.position = 'relative';
    screenshotContainer.style.width = '1200px';  // 너비를 2배로 증가
    screenshotContainer.style.height = '1200px'; // 높이를 2배로 증가

    // 지도의 복사본 생성
    const mapClone = document.getElementById('map').cloneNode(true);
    mapClone.style.width = '100%';
    mapClone.style.height = '100%';
    screenshotContainer.appendChild(mapClone);

    // 통계 카드의 복사본 생성
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) {
        const infoPanelClone = infoPanel.cloneNode(true);
        infoPanelClone.classList.remove('hidden');
        infoPanelClone.style.position = 'absolute';
        infoPanelClone.style.top = '20px';
        infoPanelClone.style.right = '20px';
        infoPanelClone.style.zIndex = '1000';
        infoPanelClone.style.transform = 'scale(1.0)'; // 통계 카드 크기를 1.5배로 증가
        infoPanelClone.style.transformOrigin = 'top right';
        screenshotContainer.appendChild(infoPanelClone);
    }

    // 임시로 body에 추가
    document.body.appendChild(screenshotContainer);

    // 지도 중심 및 줌 레벨 조정
    const mapInstance = new google.maps.Map(mapClone, {
        center: { lat: 20, lng: 0 }, // 적절한 중심점 설정
        zoom: 2, // 줌 레벨을 낮춰 더 넓은 영역 표시
        styles: [
            {
                featureType: 'all',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });

    // 기존 지도의 데이터 레이어를 새 지도에 복사
    mapInstance.data.setStyle(map.data.getStyle());
    map.data.forEach((feature) => {
        mapInstance.data.add(feature);
    });

    // 스크린샷 생성 (지도가 렌더링될 시간을 주기 위해 약간의 지연 추가)
    await new Promise(resolve => setTimeout(resolve, 1000));
    const canvas = await html2canvas(screenshotContainer, {
        useCORS: true,
        logging: false,
        scale: 1,
        width: 1200,
        height: 1200
    });

    // 임시 요소 제거
    document.body.removeChild(screenshotContainer);

    // 스크린샷 다운로드
    const link = document.createElement('a');
    link.download = 'travel_map_screenshot.png';
    link.href = canvas.toDataURL();
    link.click();
}
// 링크 복사 함수
function copyLink() {
    const shareData = JSON.stringify(travelData);
    const encodedData = btoa(shareData);
    const shareUrl = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('링크가 클립보드에 복사되었습니다!');
    }).catch(err => {
        console.error('링크 복사 실패:', err);
    });
}

// 공유 모달 표시 함수
function showShareModal() {
    console.log('Showing share modal');
    const shareModal = document.getElementById('share-modal');
    if (shareModal) {
        shareModal.style.display = 'block';
    } else {
        console.error('Share modal not found');
    }
}

// 공유 모달 닫기 함수
function closeShareModal() {
    const shareModal = document.getElementById('share-modal');
    if (shareModal) {
        shareModal.style.display = 'none';
    }
}

// 이벤트 리스너 추가 함수
function initShareFeatures() {
    const shareButton = document.getElementById('share-button');
    if (shareButton) {
        shareButton.removeEventListener('click', shareMap); // 기존 이벤트 리스너 제거
        shareButton.addEventListener('click', showShareModal);
    } else {
        console.error('Share button not found');
    }

    const saveScreenshotButton = document.getElementById('save-screenshot');
    if (saveScreenshotButton) {
        saveScreenshotButton.addEventListener('click', saveScreenshot);
    }

    const copyLinkButton = document.getElementById('copy-link');
    if (copyLinkButton) {
        copyLinkButton.addEventListener('click', copyLink);
    }

    const closeModalButton = document.getElementById('close-share-modal');
    if (closeModalButton) {
        closeModalButton.addEventListener('click', closeShareModal);
    }
}

// DOM이 로드된 후 초기화 함수 실행
document.addEventListener('DOMContentLoaded', initializeApp);

// 기존 코드에 추가
document.addEventListener('DOMContentLoaded', function () {
    const dropdownBtn = document.getElementById('language-dropdown-btn');
    const dropdownContent = document.getElementById('language-dropdown-content');

    dropdownBtn.addEventListener('click', function () {
        dropdownContent.classList.toggle('show');
    });

    // 드롭다운 외부를 클릭하면 드롭다운이 닫힘
    window.addEventListener('click', function (event) {
        if (!event.target.matches('#language-dropdown-btn')) {
            if (dropdownContent.classList.contains('show')) {
                dropdownContent.classList.remove('show');
            }
        }
    });
});

// 초기 언어 설정
document.addEventListener('DOMContentLoaded', function () {
    changeLanguage(currentLanguage);
});
