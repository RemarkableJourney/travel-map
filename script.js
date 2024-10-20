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

// 지도 초기화 함수
function initMap() {
    loadData(); // 초기화 시 저장된 데이터 불러오기

    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 2,
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
}

// GeoJSON 데이터 로드 함수
function loadGeoJson() {
    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
        .then(response => response.json())
        .then(data => {
            map.data.addGeoJson(data);

            totalCountries = data.features.length;

            data.features.forEach(feature => {
                const countryCode = feature.properties.ISO_A2;
                const countryName = feature.properties.ADMIN;
                const continent = getContinent(feature.properties);

                console.log(`Country: ${countryName}, Code: ${countryCode}, Continent: ${continent}`);

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

            console.log('Continents object:', continents);

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
    console.log(`Country: ${properties.ADMIN}, Code: ${countryCode}, Continent: ${continent}`);
    return continent;
}

// 지도 스타일 설 함수
function setMapStyle() {
    map.data.setStyle(function (feature) {
        const countryCode = feature.getProperty('ISO_A2');
        let fillColor = '#F0F0F0'; // 방문하지 않은 국가의 기본 색상 (매우 밝은 회색)
        let strokeColor = '#A0A0A0'; // 기본 테두리 색상
        let strokeWeight = 0.5; // 기본 테두리 두께
        let fillOpacity = 0.8; // 기본 투명도

        if (travelData.visited.includes(countryCode)) {
            fillColor = '#4CAF50'; // 방문한 국가 색상 (녹색)
            strokeColor = '#45a049'; // 방문한 국가 테두리 색상 (진한 녹색)
            strokeWeight = 1; // 방문한 국가 테두리 두께 증가
            fillOpacity = 0.7; // 방문한 국가 투명도 조정
        } else if (travelData.wishlist.includes(countryCode)) {
            fillColor = '#FFC107'; // 가고 싶은 국가 색상 (노란색)
            strokeColor = '#FFA000'; // 가고 싶은 국가 테두리 색상 (진한 노란색)
            strokeWeight = 1; // 가고 싶은 국가 테두리 두께 약간 증가
            fillOpacity = 0.7; // 가고 싶은 국가 투명도 조정
        }

        return {
            fillColor: fillColor,
            fillOpacity: fillOpacity,
            strokeColor: strokeColor,
            strokeWeight: strokeWeight
        };
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
                fontSize: "8px",  // 원래 크기로 돌아갑니다
                fontWeight: "bold"
            });
        }
        map.data.revertStyle();
    });
}

// 국가 상태 토글 함수
function toggleCountryStatus(countryCode) {
    if (travelData.visited.includes(countryCode)) {
        travelData.visited = travelData.visited.filter(code => code !== countryCode);
        travelData.wishlist.push(countryCode);
    } else if (travelData.wishlist.includes(countryCode)) {
        travelData.wishlist = travelData.wishlist.filter(code => code !== countryCode);
    } else {
        travelData.visited.push(countryCode);
    }

    setMapStyle();
    updateTravelInfo();
    saveData(); // 상태가 변경될 때마다 데이터 저장
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

    // 마우스 커서 위치 가져오기
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
            toggleButton.textContent = '방문한 국가 목록 보기';
        }
    });

    const continentFilter = document.getElementById('continent-filter');
    continentFilter.addEventListener('change', updateTravelInfo);
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

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    await login(email, password);
});
