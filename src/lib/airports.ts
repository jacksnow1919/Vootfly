export type Airport = {
  code: string;
  name: string;
  city: string;
  country: string;
  /** Metro / city code shared by all airports in the same city (e.g. NYC, LON). */
  cityCode?: string;
};

export const airports: Airport[] = [
  { code: "GOI", name: "Dabolim Goa Intl", city: "Goa", country: "India", cityCode: "GOI" },
  { code: "GOX", name: "Manohar Intl (Mopa)", city: "Goa", country: "India", cityCode: "GOI" },
  { code: "DEL", name: "Indira Gandhi Intl", city: "Delhi", country: "India", cityCode: "DEL" },
  { code: "BOM", name: "Chhatrapati Shivaji Maharaj Intl", city: "Mumbai", country: "India", cityCode: "BOM" },
  { code: "BLR", name: "Kempegowda Intl", city: "Bengaluru", country: "India", cityCode: "BLR" },
  { code: "MAA", name: "Chennai Intl", city: "Chennai", country: "India", cityCode: "MAA" },
  { code: "HYD", name: "Rajiv Gandhi Intl", city: "Hyderabad", country: "India", cityCode: "HYD" },
  { code: "CCU", name: "Netaji Subhas Chandra Bose Intl", city: "Kolkata", country: "India", cityCode: "CCU" },
  { code: "COK", name: "Cochin Intl", city: "Kochi", country: "India", cityCode: "COK" },
  { code: "TRV", name: "Trivandrum Intl", city: "Thiruvananthapuram", country: "India", cityCode: "TRV" },
  { code: "AMD", name: "Sardar Vallabhbhai Patel Intl", city: "Ahmedabad", country: "India", cityCode: "AMD" },
  { code: "PNQ", name: "Pune", city: "Pune", country: "India", cityCode: "PNQ" },
  { code: "JAI", name: "Jaipur Intl", city: "Jaipur", country: "India", cityCode: "JAI" },
  { code: "LKO", name: "Chaudhary Charan Singh Intl", city: "Lucknow", country: "India", cityCode: "LKO" },
  { code: "IXC", name: "Chandigarh", city: "Chandigarh", country: "India", cityCode: "IXC" },
  { code: "ATQ", name: "Sri Guru Ram Dass Jee Intl", city: "Amritsar", country: "India", cityCode: "ATQ" },
  { code: "SXR", name: "Srinagar Intl", city: "Srinagar", country: "India", cityCode: "SXR" },
  { code: "IXB", name: "Bagdogra", city: "Siliguri", country: "India", cityCode: "IXB" },
  { code: "GAU", name: "Lokpriya Gopinath Bordoloi Intl", city: "Guwahati", country: "India", cityCode: "GAU" },
  { code: "BBI", name: "Biju Patnaik Intl", city: "Bhubaneswar", country: "India", cityCode: "BBI" },
  { code: "NAG", name: "Dr. Babasaheb Ambedkar Intl", city: "Nagpur", country: "India", cityCode: "NAG" },
  { code: "IDR", name: "Devi Ahilyabai Holkar", city: "Indore", country: "India", cityCode: "IDR" },
  { code: "VNS", name: "Lal Bahadur Shastri Intl", city: "Varanasi", country: "India", cityCode: "VNS" },
  { code: "PAT", name: "Jay Prakash Narayan", city: "Patna", country: "India", cityCode: "PAT" },
  { code: "IXM", name: "Madurai", city: "Madurai", country: "India", cityCode: "IXM" },
  { code: "CJB", name: "Coimbatore Intl", city: "Coimbatore", country: "India", cityCode: "CJB" },
  { code: "IXE", name: "Mangaluru Intl", city: "Mangaluru", country: "India", cityCode: "IXE" },
  { code: "VTZ", name: "Visakhapatnam", city: "Visakhapatnam", country: "India", cityCode: "VTZ" },
  { code: "RPR", name: "Swami Vivekananda", city: "Raipur", country: "India", cityCode: "RPR" },
  { code: "BDQ", name: "Vadodara", city: "Vadodara", country: "India", cityCode: "BDQ" },
  { code: "STV", name: "Surat", city: "Surat", country: "India", cityCode: "STV" },
  { code: "UDR", name: "Maharana Pratap", city: "Udaipur", country: "India", cityCode: "UDR" },
  { code: "JDH", name: "Jodhpur", city: "Jodhpur", country: "India", cityCode: "JDH" },
  { code: "DED", name: "Dehradun (Jolly Grant)", city: "Dehradun", country: "India", cityCode: "DED" },
  { code: "IXJ", name: "Jammu", city: "Jammu", country: "India", cityCode: "IXJ" },
  { code: "IXL", name: "Leh Kushok Bakula Rimpochee", city: "Leh", country: "India", cityCode: "IXL" },
  { code: "IXZ", name: "Port Blair Veer Savarkar", city: "Port Blair", country: "India", cityCode: "IXZ" },
  { code: "TIR", name: "Tirupati", city: "Tirupati", country: "India", cityCode: "TIR" },
  { code: "HBX", name: "Hubli", city: "Hubli", country: "India", cityCode: "HBX" },
  { code: "JFK", name: "John F. Kennedy Intl", city: "New York", country: "United States", cityCode: "NYC" },
  { code: "EWR", name: "Newark Liberty Intl", city: "New York", country: "United States", cityCode: "NYC" },
  { code: "LGA", name: "LaGuardia", city: "New York", country: "United States", cityCode: "NYC" },
  { code: "LAX", name: "Los Angeles Intl", city: "Los Angeles", country: "United States", cityCode: "LAX" },
  { code: "SFO", name: "San Francisco Intl", city: "San Francisco", country: "United States", cityCode: "SFO" },
  { code: "SJC", name: "Norman Y. Mineta San Jose Intl", city: "San Jose", country: "United States", cityCode: "SJC" },
  { code: "OAK", name: "Oakland Intl", city: "Oakland", country: "United States", cityCode: "SFO" },
  { code: "ORD", name: "O'Hare Intl", city: "Chicago", country: "United States", cityCode: "CHI" },
  { code: "MDW", name: "Midway Intl", city: "Chicago", country: "United States", cityCode: "CHI" },
  { code: "MIA", name: "Miami Intl", city: "Miami", country: "United States", cityCode: "MIA" },
  { code: "FLL", name: "Fort Lauderdale-Hollywood Intl", city: "Fort Lauderdale", country: "United States", cityCode: "MIA" },
  { code: "MCO", name: "Orlando Intl", city: "Orlando", country: "United States", cityCode: "MCO" },
  { code: "TPA", name: "Tampa Intl", city: "Tampa", country: "United States", cityCode: "TPA" },
  { code: "ATL", name: "Hartsfield-Jackson Atlanta Intl", city: "Atlanta", country: "United States", cityCode: "ATL" },
  { code: "DFW", name: "Dallas/Fort Worth Intl", city: "Dallas", country: "United States", cityCode: "DFW" },
  { code: "DAL", name: "Dallas Love Field", city: "Dallas", country: "United States", cityCode: "DFW" },
  { code: "IAH", name: "George Bush Intercontinental", city: "Houston", country: "United States", cityCode: "HOU" },
  { code: "DEN", name: "Denver Intl", city: "Denver", country: "United States", cityCode: "DEN" },
  { code: "SEA", name: "Seattle-Tacoma Intl", city: "Seattle", country: "United States", cityCode: "SEA" },
  { code: "PDX", name: "Portland Intl", city: "Portland", country: "United States", cityCode: "PDX" },
  { code: "LAS", name: "Harry Reid Intl", city: "Las Vegas", country: "United States", cityCode: "LAS" },
  { code: "PHX", name: "Phoenix Sky Harbor Intl", city: "Phoenix", country: "United States", cityCode: "PHX" },
  { code: "SAN", name: "San Diego Intl", city: "San Diego", country: "United States", cityCode: "SAN" },
  { code: "BOS", name: "Logan Intl", city: "Boston", country: "United States", cityCode: "BOS" },
  { code: "PHL", name: "Philadelphia Intl", city: "Philadelphia", country: "United States", cityCode: "PHL" },
  { code: "IAD", name: "Washington Dulles Intl", city: "Washington", country: "United States", cityCode: "WAS" },
  { code: "DCA", name: "Ronald Reagan Washington National", city: "Washington", country: "United States", cityCode: "WAS" },
  { code: "BWI", name: "Baltimore/Washington Intl", city: "Baltimore", country: "United States", cityCode: "WAS" },
  { code: "DTW", name: "Detroit Metropolitan", city: "Detroit", country: "United States", cityCode: "DTT" },
  { code: "MSP", name: "Minneapolis-Saint Paul Intl", city: "Minneapolis", country: "United States", cityCode: "MSP" },
  { code: "CLT", name: "Charlotte Douglas Intl", city: "Charlotte", country: "United States", cityCode: "CLT" },
  { code: "SLC", name: "Salt Lake City Intl", city: "Salt Lake City", country: "United States", cityCode: "SLC" },
  { code: "AUS", name: "Austin-Bergstrom Intl", city: "Austin", country: "United States", cityCode: "AUS" },
  { code: "RDU", name: "Raleigh-Durham Intl", city: "Raleigh", country: "United States", cityCode: "RDU" },
  { code: "HNL", name: "Daniel K. Inouye Intl", city: "Honolulu", country: "United States", cityCode: "HNL" },
  { code: "YYZ", name: "Toronto Pearson Intl", city: "Toronto", country: "Canada", cityCode: "YTO" },
  { code: "YUL", name: "Montreal-Trudeau Intl", city: "Montreal", country: "Canada", cityCode: "YMQ" },
  { code: "YVR", name: "Vancouver Intl", city: "Vancouver", country: "Canada", cityCode: "YVR" },
  { code: "YYC", name: "Calgary Intl", city: "Calgary", country: "Canada", cityCode: "YYC" },
  { code: "YEG", name: "Edmonton Intl", city: "Edmonton", country: "Canada", cityCode: "YEG" },
  { code: "YOW", name: "Ottawa Macdonald-Cartier Intl", city: "Ottawa", country: "Canada", cityCode: "YOW" },
  { code: "LHR", name: "Heathrow", city: "London", country: "United Kingdom", cityCode: "LON" },
  { code: "LGW", name: "Gatwick", city: "London", country: "United Kingdom", cityCode: "LON" },
  { code: "STN", name: "Stansted", city: "London", country: "United Kingdom", cityCode: "LON" },
  { code: "LTN", name: "Luton", city: "London", country: "United Kingdom", cityCode: "LON" },
  { code: "LCY", name: "London City", city: "London", country: "United Kingdom", cityCode: "LON" },
  { code: "MAN", name: "Manchester", city: "Manchester", country: "United Kingdom", cityCode: "MAN" },
  { code: "BHX", name: "Birmingham", city: "Birmingham", country: "United Kingdom", cityCode: "BHX" },
  { code: "EDI", name: "Edinburgh", city: "Edinburgh", country: "United Kingdom", cityCode: "EDI" },
  { code: "GLA", name: "Glasgow", city: "Glasgow", country: "United Kingdom", cityCode: "GLA" },
  { code: "DUB", name: "Dublin", city: "Dublin", country: "Ireland", cityCode: "DUB" },
  { code: "CDG", name: "Charles de Gaulle", city: "Paris", country: "France", cityCode: "PAR" },
  { code: "ORY", name: "Orly", city: "Paris", country: "France", cityCode: "PAR" },
  { code: "NCE", name: "Cote d'Azur", city: "Nice", country: "France", cityCode: "NCE" },
  { code: "LYS", name: "Lyon-Saint Exupery", city: "Lyon", country: "France", cityCode: "LYS" },
  { code: "MRS", name: "Marseille Provence", city: "Marseille", country: "France", cityCode: "MRS" },
  { code: "FRA", name: "Frankfurt am Main", city: "Frankfurt", country: "Germany", cityCode: "FRA" },
  { code: "MUC", name: "Munich", city: "Munich", country: "Germany", cityCode: "MUC" },
  { code: "BER", name: "Berlin Brandenburg", city: "Berlin", country: "Germany", cityCode: "BER" },
  { code: "DUS", name: "Dusseldorf", city: "Dusseldorf", country: "Germany", cityCode: "DUS" },
  { code: "HAM", name: "Hamburg", city: "Hamburg", country: "Germany", cityCode: "HAM" },
  { code: "STR", name: "Stuttgart", city: "Stuttgart", country: "Germany", cityCode: "STR" },
  { code: "AMS", name: "Schiphol", city: "Amsterdam", country: "Netherlands", cityCode: "AMS" },
  { code: "BRU", name: "Brussels", city: "Brussels", country: "Belgium", cityCode: "BRU" },
  { code: "ZRH", name: "Zurich", city: "Zurich", country: "Switzerland", cityCode: "ZRH" },
  { code: "GVA", name: "Geneva", city: "Geneva", country: "Switzerland", cityCode: "GVA" },
  { code: "VIE", name: "Vienna Intl", city: "Vienna", country: "Austria", cityCode: "VIE" },
  { code: "CPH", name: "Copenhagen", city: "Copenhagen", country: "Denmark", cityCode: "CPH" },
  { code: "ARN", name: "Stockholm Arlanda", city: "Stockholm", country: "Sweden", cityCode: "STO" },
  { code: "OSL", name: "Oslo Gardermoen", city: "Oslo", country: "Norway", cityCode: "OSL" },
  { code: "HEL", name: "Helsinki-Vantaa", city: "Helsinki", country: "Finland", cityCode: "HEL" },
  { code: "MAD", name: "Adolfo Suarez Madrid-Barajas", city: "Madrid", country: "Spain", cityCode: "MAD" },
  { code: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "Spain", cityCode: "BCN" },
  { code: "AGP", name: "Malaga", city: "Malaga", country: "Spain", cityCode: "AGP" },
  { code: "PMI", name: "Palma de Mallorca", city: "Palma", country: "Spain", cityCode: "PMI" },
  { code: "LIS", name: "Humberto Delgado", city: "Lisbon", country: "Portugal", cityCode: "LIS" },
  { code: "OPO", name: "Francisco Sa Carneiro", city: "Porto", country: "Portugal", cityCode: "OPO" },
  { code: "FCO", name: "Fiumicino", city: "Rome", country: "Italy", cityCode: "ROM" },
  { code: "MXP", name: "Malpensa", city: "Milan", country: "Italy", cityCode: "MIL" },
  { code: "LIN", name: "Linate", city: "Milan", country: "Italy", cityCode: "MIL" },
  { code: "VCE", name: "Marco Polo", city: "Venice", country: "Italy", cityCode: "VCE" },
  { code: "NAP", name: "Naples Intl", city: "Naples", country: "Italy", cityCode: "NAP" },
  { code: "ATH", name: "Athens Intl", city: "Athens", country: "Greece", cityCode: "ATH" },
  { code: "IST", name: "Istanbul", city: "Istanbul", country: "Turkey", cityCode: "IST" },
  { code: "SAW", name: "Sabiha Gokcen", city: "Istanbul", country: "Turkey", cityCode: "IST" },
  { code: "AYT", name: "Antalya", city: "Antalya", country: "Turkey", cityCode: "AYT" },
  { code: "PRG", name: "Vaclav Havel", city: "Prague", country: "Czechia", cityCode: "PRG" },
  { code: "WAW", name: "Chopin", city: "Warsaw", country: "Poland", cityCode: "WAW" },
  { code: "BUD", name: "Budapest Ferenc Liszt", city: "Budapest", country: "Hungary", cityCode: "BUD" },
  { code: "OTP", name: "Henri Coanda", city: "Bucharest", country: "Romania", cityCode: "OTP" },
  { code: "KBP", name: "Boryspil", city: "Kyiv", country: "Ukraine", cityCode: "IEV" },
  { code: "SVO", name: "Sheremetyevo", city: "Moscow", country: "Russia", cityCode: "MOW" },
  { code: "DME", name: "Domodedovo", city: "Moscow", country: "Russia", cityCode: "MOW" },
  { code: "LED", name: "Pulkovo", city: "Saint Petersburg", country: "Russia", cityCode: "LED" },
  { code: "DXB", name: "Dubai Intl", city: "Dubai", country: "United Arab Emirates", cityCode: "DXB" },
  { code: "DWC", name: "Al Maktoum Intl", city: "Dubai", country: "United Arab Emirates", cityCode: "DXB" },
  { code: "AUH", name: "Zayed Intl", city: "Abu Dhabi", country: "United Arab Emirates", cityCode: "AUH" },
  { code: "SHJ", name: "Sharjah Intl", city: "Sharjah", country: "United Arab Emirates", cityCode: "SHJ" },
  { code: "DOH", name: "Hamad Intl", city: "Doha", country: "Qatar", cityCode: "DOH" },
  { code: "KWI", name: "Kuwait Intl", city: "Kuwait City", country: "Kuwait", cityCode: "KWI" },
  { code: "BAH", name: "Bahrain Intl", city: "Manama", country: "Bahrain", cityCode: "BAH" },
  { code: "MCT", name: "Muscat Intl", city: "Muscat", country: "Oman", cityCode: "MCT" },
  { code: "RUH", name: "King Khalid Intl", city: "Riyadh", country: "Saudi Arabia", cityCode: "RUH" },
  { code: "JED", name: "King Abdulaziz Intl", city: "Jeddah", country: "Saudi Arabia", cityCode: "JED" },
  { code: "DMM", name: "King Fahd Intl", city: "Dammam", country: "Saudi Arabia", cityCode: "DMM" },
  { code: "AMM", name: "Queen Alia Intl", city: "Amman", country: "Jordan", cityCode: "AMM" },
  { code: "BEY", name: "Rafic Hariri Intl", city: "Beirut", country: "Lebanon", cityCode: "BEY" },
  { code: "TLV", name: "Ben Gurion", city: "Tel Aviv", country: "Israel", cityCode: "TLV" },
  { code: "CAI", name: "Cairo Intl", city: "Cairo", country: "Egypt", cityCode: "CAI" },
  { code: "HRG", name: "Hurghada Intl", city: "Hurghada", country: "Egypt", cityCode: "HRG" },
  { code: "CMN", name: "Mohammed V Intl", city: "Casablanca", country: "Morocco", cityCode: "CMN" },
  { code: "RAK", name: "Marrakesh Menara", city: "Marrakesh", country: "Morocco", cityCode: "RAK" },
  { code: "TUN", name: "Tunis-Carthage", city: "Tunis", country: "Tunisia", cityCode: "TUN" },
  { code: "ALG", name: "Houari Boumediene", city: "Algiers", country: "Algeria", cityCode: "ALG" },
  { code: "LOS", name: "Murtala Muhammed Intl", city: "Lagos", country: "Nigeria", cityCode: "LOS" },
  { code: "ABV", name: "Nnamdi Azikiwe Intl", city: "Abuja", country: "Nigeria", cityCode: "ABV" },
  { code: "ACC", name: "Kotoka Intl", city: "Accra", country: "Ghana", cityCode: "ACC" },
  { code: "NBO", name: "Jomo Kenyatta Intl", city: "Nairobi", country: "Kenya", cityCode: "NBO" },
  { code: "ADD", name: "Bole Intl", city: "Addis Ababa", country: "Ethiopia", cityCode: "ADD" },
  { code: "DAR", name: "Julius Nyerere Intl", city: "Dar es Salaam", country: "Tanzania", cityCode: "DAR" },
  { code: "JNB", name: "O. R. Tambo Intl", city: "Johannesburg", country: "South Africa", cityCode: "JNB" },
  { code: "CPT", name: "Cape Town Intl", city: "Cape Town", country: "South Africa", cityCode: "CPT" },
  { code: "DUR", name: "King Shaka Intl", city: "Durban", country: "South Africa", cityCode: "DUR" },
  { code: "MRU", name: "Sir Seewoosagur Ramgoolam Intl", city: "Port Louis", country: "Mauritius", cityCode: "MRU" },
  { code: "SEZ", name: "Seychelles Intl", city: "Mahe", country: "Seychelles", cityCode: "SEZ" },
  { code: "MLE", name: "Velana Intl", city: "Male", country: "Maldives", cityCode: "MLE" },
  { code: "CMB", name: "Bandaranaike Intl", city: "Colombo", country: "Sri Lanka", cityCode: "CMB" },
  { code: "KTM", name: "Tribhuvan Intl", city: "Kathmandu", country: "Nepal", cityCode: "KTM" },
  { code: "DAC", name: "Hazrat Shahjalal Intl", city: "Dhaka", country: "Bangladesh", cityCode: "DAC" },
  { code: "CGP", name: "Shah Amanat Intl", city: "Chittagong", country: "Bangladesh", cityCode: "CGP" },
  { code: "KHI", name: "Jinnah Intl", city: "Karachi", country: "Pakistan", cityCode: "KHI" },
  { code: "LHE", name: "Allama Iqbal Intl", city: "Lahore", country: "Pakistan", cityCode: "LHE" },
  { code: "ISB", name: "Islamabad Intl", city: "Islamabad", country: "Pakistan", cityCode: "ISB" },
  { code: "KBL", name: "Hamid Karzai Intl", city: "Kabul", country: "Afghanistan", cityCode: "KBL" },
  { code: "THR", name: "Mehrabad", city: "Tehran", country: "Iran", cityCode: "THR" },
  { code: "IKA", name: "Imam Khomeini Intl", city: "Tehran", country: "Iran", cityCode: "THR" },
  { code: "TAS", name: "Tashkent Intl", city: "Tashkent", country: "Uzbekistan", cityCode: "TAS" },
  { code: "ALA", name: "Almaty Intl", city: "Almaty", country: "Kazakhstan", cityCode: "ALA" },
  { code: "SIN", name: "Changi", city: "Singapore", country: "Singapore", cityCode: "SIN" },
  { code: "KUL", name: "Kuala Lumpur Intl", city: "Kuala Lumpur", country: "Malaysia", cityCode: "KUL" },
  { code: "PEN", name: "Penang Intl", city: "Penang", country: "Malaysia", cityCode: "PEN" },
  { code: "BKI", name: "Kota Kinabalu Intl", city: "Kota Kinabalu", country: "Malaysia", cityCode: "BKI" },
  { code: "BKK", name: "Suvarnabhumi", city: "Bangkok", country: "Thailand", cityCode: "BKK" },
  { code: "DMK", name: "Don Mueang Intl", city: "Bangkok", country: "Thailand", cityCode: "BKK" },
  { code: "HKT", name: "Phuket Intl", city: "Phuket", country: "Thailand", cityCode: "HKT" },
  { code: "CNX", name: "Chiang Mai Intl", city: "Chiang Mai", country: "Thailand", cityCode: "CNX" },
  { code: "CGK", name: "Soekarno-Hatta Intl", city: "Jakarta", country: "Indonesia", cityCode: "JKT" },
  { code: "DPS", name: "Ngurah Rai Intl", city: "Bali", country: "Indonesia", cityCode: "DPS" },
  { code: "SUB", name: "Juanda Intl", city: "Surabaya", country: "Indonesia", cityCode: "SUB" },
  { code: "MNL", name: "Ninoy Aquino Intl", city: "Manila", country: "Philippines", cityCode: "MNL" },
  { code: "CEB", name: "Mactan-Cebu Intl", city: "Cebu", country: "Philippines", cityCode: "CEB" },
  { code: "SGN", name: "Tan Son Nhat Intl", city: "Ho Chi Minh City", country: "Vietnam", cityCode: "SGN" },
  { code: "HAN", name: "Noi Bai Intl", city: "Hanoi", country: "Vietnam", cityCode: "HAN" },
  { code: "DAD", name: "Da Nang Intl", city: "Da Nang", country: "Vietnam", cityCode: "DAD" },
  { code: "PNH", name: "Phnom Penh Intl", city: "Phnom Penh", country: "Cambodia", cityCode: "PNH" },
  { code: "REP", name: "Siem Reap Angkor Intl", city: "Siem Reap", country: "Cambodia", cityCode: "REP" },
  { code: "RGN", name: "Yangon Intl", city: "Yangon", country: "Myanmar", cityCode: "RGN" },
  { code: "HKG", name: "Hong Kong Intl", city: "Hong Kong", country: "Hong Kong", cityCode: "HKG" },
  { code: "MFM", name: "Macau Intl", city: "Macau", country: "Macau", cityCode: "MFM" },
  { code: "TPE", name: "Taoyuan Intl", city: "Taipei", country: "Taiwan", cityCode: "TPE" },
  { code: "PEK", name: "Beijing Capital Intl", city: "Beijing", country: "China", cityCode: "BJS" },
  { code: "PKX", name: "Beijing Daxing Intl", city: "Beijing", country: "China", cityCode: "BJS" },
  { code: "PVG", name: "Shanghai Pudong Intl", city: "Shanghai", country: "China", cityCode: "SHA" },
  { code: "SHA", name: "Shanghai Hongqiao Intl", city: "Shanghai", country: "China", cityCode: "SHA" },
  { code: "CAN", name: "Guangzhou Baiyun Intl", city: "Guangzhou", country: "China", cityCode: "CAN" },
  { code: "SZX", name: "Shenzhen Bao'an Intl", city: "Shenzhen", country: "China", cityCode: "SZX" },
  { code: "CTU", name: "Chengdu Tianfu Intl", city: "Chengdu", country: "China", cityCode: "CTU" },
  { code: "XIY", name: "Xi'an Xianyang Intl", city: "Xi'an", country: "China", cityCode: "XIY" },
  { code: "HGH", name: "Hangzhou Xiaoshan Intl", city: "Hangzhou", country: "China", cityCode: "HGH" },
  { code: "NRT", name: "Narita Intl", city: "Tokyo", country: "Japan", cityCode: "TYO" },
  { code: "HND", name: "Haneda", city: "Tokyo", country: "Japan", cityCode: "TYO" },
  { code: "KIX", name: "Kansai Intl", city: "Osaka", country: "Japan", cityCode: "OSA" },
  { code: "ITM", name: "Itami", city: "Osaka", country: "Japan", cityCode: "OSA" },
  { code: "NGO", name: "Chubu Centrair Intl", city: "Nagoya", country: "Japan", cityCode: "NGO" },
  { code: "CTS", name: "New Chitose", city: "Sapporo", country: "Japan", cityCode: "SPK" },
  { code: "FUK", name: "Fukuoka", city: "Fukuoka", country: "Japan", cityCode: "FUK" },
  { code: "ICN", name: "Incheon Intl", city: "Seoul", country: "South Korea", cityCode: "SEL" },
  { code: "GMP", name: "Gimpo Intl", city: "Seoul", country: "South Korea", cityCode: "SEL" },
  { code: "PUS", name: "Gimhae Intl", city: "Busan", country: "South Korea", cityCode: "PUS" },
  { code: "SYD", name: "Kingsford Smith", city: "Sydney", country: "Australia", cityCode: "SYD" },
  { code: "MEL", name: "Melbourne", city: "Melbourne", country: "Australia", cityCode: "MEL" },
  { code: "BNE", name: "Brisbane", city: "Brisbane", country: "Australia", cityCode: "BNE" },
  { code: "PER", name: "Perth", city: "Perth", country: "Australia", cityCode: "PER" },
  { code: "ADL", name: "Adelaide", city: "Adelaide", country: "Australia", cityCode: "ADL" },
  { code: "AKL", name: "Auckland", city: "Auckland", country: "New Zealand", cityCode: "AKL" },
  { code: "CHC", name: "Christchurch", city: "Christchurch", country: "New Zealand", cityCode: "CHC" },
  { code: "WLG", name: "Wellington", city: "Wellington", country: "New Zealand", cityCode: "WLG" },
  { code: "NAN", name: "Nadi Intl", city: "Nadi", country: "Fiji", cityCode: "NAN" },
  { code: "GRU", name: "Guarulhos Intl", city: "Sao Paulo", country: "Brazil", cityCode: "SAO" },
  { code: "GIG", name: "Galeao Intl", city: "Rio de Janeiro", country: "Brazil", cityCode: "RIO" },
  { code: "BSB", name: "Brasilia Intl", city: "Brasilia", country: "Brazil", cityCode: "BSB" },
  { code: "EZE", name: "Ministro Pistarini", city: "Buenos Aires", country: "Argentina", cityCode: "BUE" },
  { code: "SCL", name: "Arturo Merino Benitez", city: "Santiago", country: "Chile", cityCode: "SCL" },
  { code: "LIM", name: "Jorge Chavez Intl", city: "Lima", country: "Peru", cityCode: "LIM" },
  { code: "BOG", name: "El Dorado Intl", city: "Bogota", country: "Colombia", cityCode: "BOG" },
  { code: "UIO", name: "Mariscal Sucre Intl", city: "Quito", country: "Ecuador", cityCode: "UIO" },
  { code: "PTY", name: "Tocumen Intl", city: "Panama City", country: "Panama", cityCode: "PTY" },
  { code: "MEX", name: "Benito Juarez Intl", city: "Mexico City", country: "Mexico", cityCode: "MEX" },
  { code: "CUN", name: "Cancun Intl", city: "Cancun", country: "Mexico", cityCode: "CUN" },
  { code: "GDL", name: "Guadalajara Intl", city: "Guadalajara", country: "Mexico", cityCode: "GDL" },
  { code: "HAV", name: "Jose Marti Intl", city: "Havana", country: "Cuba", cityCode: "HAV" },
  { code: "SJU", name: "Luis Munoz Marin Intl", city: "San Juan", country: "Puerto Rico", cityCode: "SJU" },
  { code: "PUJ", name: "Punta Cana Intl", city: "Punta Cana", country: "Dominican Republic", cityCode: "PUJ" },
  { code: "KIN", name: "Norman Manley Intl", city: "Kingston", country: "Jamaica", cityCode: "KIN" },
  { code: "NAS", name: "Lynden Pindling Intl", city: "Nassau", country: "Bahamas", cityCode: "NAS" },];

/** Extra city aliases so common local names resolve (e.g. "Bombay" -> BOM). */
const cityAliases: Record<string, string[]> = {
  GOI: ["panaji", "panjim", "dabolim"],
  GOX: ["mopa", "north goa"],
  BOM: ["bombay"],
  MAA: ["madras"],
  CCU: ["calcutta"],
  BLR: ["bangalore"],
  COK: ["cochin", "ernakulam"],
  TRV: ["trivandrum"],
  DEL: ["new delhi"],
  IXC: ["mohali"],
  SGN: ["saigon"],
  PEK: ["peking"],
  ICN: ["seoul incheon"],
  NYC: ["new york city"],
};

/** Country aliases so "UK", "USA", "UAE", "Emirates" resolve to the right country. */
const countryAliases: Record<string, string[]> = {
  "united kingdom": ["uk", "great britain", "britain", "england", "gb"],
  "united states": ["usa", "us", "america", "united states of america"],
  "united arab emirates": ["uae", "emirates", "dubai emirates"],
  "south korea": ["korea"],
  netherlands: ["holland"],
  "czech republic": ["czechia"],
  "hong kong": ["hongkong"],
  turkey: ["turkiye"],
};

/** Hub airports ranked first inside a country match. */
const HUB_RANK: Record<string, number> = Object.fromEntries(
  [
    "DEL", "BOM", "BLR", "MAA", "HYD", "CCU", "GOX", "GOI", "COK",
    "JFK", "EWR", "LAX", "SFO", "ORD", "MIA", "IAD", "BOS", "SEA", "ATL", "DFW",
    "LHR", "LGW", "MAN", "CDG", "FRA", "MUC", "AMS", "ZRH", "MAD", "BCN", "FCO", "MXP",
    "DXB", "AUH", "DOH", "RUH", "JED", "IST", "SAW",
    "SIN", "HKG", "BKK", "KUL", "NRT", "HND", "ICN", "PEK", "PVG", "CAN",
    "SYD", "MEL", "BNE", "PER", "AKL",
    "YYZ", "YVR", "YUL", "GRU", "EZE", "MEX", "JNB", "CPT", "NBO", "CAI", "LOS",
  ].map((code, i) => [code, i]),
);

const hubRank = (code: string) => HUB_RANK[code] ?? 500;

export const searchAirports = (query: string, limit = 10): Airport[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [...airports].sort((a, b) => hubRank(a.code) - hubRank(b.code)).slice(0, limit);

  const scored = airports
    .map((a) => {
      const code = a.code.toLowerCase();
      const cityCode = (a.cityCode ?? a.code).toLowerCase();
      const city = a.city.toLowerCase();
      const name = a.name.toLowerCase();
      const country = a.country.toLowerCase();
      const aliases = [...(cityAliases[a.code] ?? []), ...(cityAliases[a.cityCode ?? ""] ?? [])];
      const countryTerms = [country, ...(countryAliases[country] ?? [])];

      let score = -1;
      if (code === q || cityCode === q || city === q) score = 0;
      else if (code.startsWith(q) || cityCode.startsWith(q)) score = 1;
      else if (city.startsWith(q) || aliases.some((al) => al.startsWith(q))) score = 2;
      // Country matches rank right after city matches so "India" lists Indian hubs.
      else if (countryTerms.some((c) => c === q || c.startsWith(q))) score = 3;
      else if (name.startsWith(q)) score = 4;
      else if (
        code.includes(q) ||
        cityCode.includes(q) ||
        city.includes(q) ||
        name.includes(q) ||
        aliases.some((al) => al.includes(q))
      )
        score = 5;
      else if (countryTerms.some((c) => c.includes(q))) score = 6;
      return { a, score };
    })
    .filter((s) => s.score >= 0)
    .sort(
      (x, y) =>
        x.score - y.score ||
        hubRank(x.a.code) - hubRank(y.a.code) ||
        x.a.city.localeCompare(y.a.city) ||
        x.a.code.localeCompare(y.a.code),
    );

  return scored.slice(0, limit).map((s) => s.a);
};

