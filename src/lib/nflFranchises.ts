import type { Conference, Division } from "../types/leagueModel";

export interface NFLFranchise {
  id: string;
  abbreviation: string;
  city: string;
  nickname: string;
  fullName: string;

  conference: Conference;
  division: Division;

  logo: string;

  primaryColor: string;
  secondaryColor: string;
}

export const nflFranchises: NFLFranchise[] = [
  // AFC EAST
  { id:"BUF",abbreviation:"BUF",city:"Buffalo",nickname:"Bills",fullName:"Buffalo Bills",conference:"AFC",division:"AFC East",logo:"/logos/BUF.png",primaryColor:"#00338D",secondaryColor:"#C60C30"},
  { id:"MIA",abbreviation:"MIA",city:"Miami",nickname:"Dolphins",fullName:"Miami Dolphins",conference:"AFC",division:"AFC East",logo:"/logos/MIA.png",primaryColor:"#008E97",secondaryColor:"#FC4C02"},
  { id:"NE",abbreviation:"NE",city:"New England",nickname:"Patriots",fullName:"New England Patriots",conference:"AFC",division:"AFC East",logo:"/logos/NE.png",primaryColor:"#002244",secondaryColor:"#C60C30"},
  { id:"NYJ",abbreviation:"NYJ",city:"New York",nickname:"Jets",fullName:"New York Jets",conference:"AFC",division:"AFC East",logo:"/logos/NYJ.png",primaryColor:"#125740",secondaryColor:"#FFFFFF"},

  // AFC NORTH
  { id:"BAL",abbreviation:"BAL",city:"Baltimore",nickname:"Ravens",fullName:"Baltimore Ravens",conference:"AFC",division:"AFC North",logo:"/logos/BAL.png",primaryColor:"#241773",secondaryColor:"#000000"},
  { id:"CIN",abbreviation:"CIN",city:"Cincinnati",nickname:"Bengals",fullName:"Cincinnati Bengals",conference:"AFC",division:"AFC North",logo:"/logos/CIN.png",primaryColor:"#FB4F14",secondaryColor:"#000000"},
  { id:"CLE",abbreviation:"CLE",city:"Cleveland",nickname:"Browns",fullName:"Cleveland Browns",conference:"AFC",division:"AFC North",logo:"/logos/CLE.png",primaryColor:"#311D00",secondaryColor:"#FF3C00"},
  { id:"PIT",abbreviation:"PIT",city:"Pittsburgh",nickname:"Steelers",fullName:"Pittsburgh Steelers",conference:"AFC",division:"AFC North",logo:"/logos/PIT.png",primaryColor:"#FFB612",secondaryColor:"#101820"},

  // AFC SOUTH
  { id:"HOU",abbreviation:"HOU",city:"Houston",nickname:"Texans",fullName:"Houston Texans",conference:"AFC",division:"AFC South",logo:"/logos/HOU.png",primaryColor:"#03202F",secondaryColor:"#A71930"},
  { id:"IND",abbreviation:"IND",city:"Indianapolis",nickname:"Colts",fullName:"Indianapolis Colts",conference:"AFC",division:"AFC South",logo:"/logos/IND.png",primaryColor:"#002C5F",secondaryColor:"#A2AAAD"},
  { id:"JAX",abbreviation:"JAX",city:"Jacksonville",nickname:"Jaguars",fullName:"Jacksonville Jaguars",conference:"AFC",division:"AFC South",logo:"/logos/JAX.png",primaryColor:"#006778",secondaryColor:"#9F792C"},
  { id:"TEN",abbreviation:"TEN",city:"Tennessee",nickname:"Titans",fullName:"Tennessee Titans",conference:"AFC",division:"AFC South",logo:"/logos/TEN.png",primaryColor:"#0C2340",secondaryColor:"#4B92DB"},

  // AFC WEST
  { id:"DEN",abbreviation:"DEN",city:"Denver",nickname:"Broncos",fullName:"Denver Broncos",conference:"AFC",division:"AFC West",logo:"/logos/DEN.png",primaryColor:"#FB4F14",secondaryColor:"#002244"},
  { id:"KC",abbreviation:"KC",city:"Kansas City",nickname:"Chiefs",fullName:"Kansas City Chiefs",conference:"AFC",division:"AFC West",logo:"/logos/KC.png",primaryColor:"#E31837",secondaryColor:"#FFB81C"},
  { id:"LV",abbreviation:"LV",city:"Las Vegas",nickname:"Raiders",fullName:"Las Vegas Raiders",conference:"AFC",division:"AFC West",logo:"/logos/LV.png",primaryColor:"#000000",secondaryColor:"#A5ACAF"},
  { id:"LAC",abbreviation:"LAC",city:"Los Angeles",nickname:"Chargers",fullName:"Los Angeles Chargers",conference:"AFC",division:"AFC West",logo:"/logos/LAC.png",primaryColor:"#0080C6",secondaryColor:"#FFC20E"},

  // NFC EAST
  { id:"DAL",abbreviation:"DAL",city:"Dallas",nickname:"Cowboys",fullName:"Dallas Cowboys",conference:"NFC",division:"NFC East",logo:"/logos/DAL.png",primaryColor:"#003594",secondaryColor:"#869397"},
  { id:"NYG",abbreviation:"NYG",city:"New York",nickname:"Giants",fullName:"New York Giants",conference:"NFC",division:"NFC East",logo:"/logos/NYG.png",primaryColor:"#0B2265",secondaryColor:"#A71930"},
  { id:"PHI",abbreviation:"PHI",city:"Philadelphia",nickname:"Eagles",fullName:"Philadelphia Eagles",conference:"NFC",division:"NFC East",logo:"/logos/PHI.png",primaryColor:"#004C54",secondaryColor:"#A5ACAF"},
  { id:"WAS",abbreviation:"WAS",city:"Washington",nickname:"Commanders",fullName:"Washington Commanders",conference:"NFC",division:"NFC East",logo:"/logos/WAS.png",primaryColor:"#5A1414",secondaryColor:"#FFB612"},

  // NFC NORTH
  { id:"CHI",abbreviation:"CHI",city:"Chicago",nickname:"Bears",fullName:"Chicago Bears",conference:"NFC",division:"NFC North",logo:"/logos/CHI.png",primaryColor:"#0B162A",secondaryColor:"#C83803"},
  { id:"DET",abbreviation:"DET",city:"Detroit",nickname:"Lions",fullName:"Detroit Lions",conference:"NFC",division:"NFC North",logo:"/logos/DET.png",primaryColor:"#0076B6",secondaryColor:"#B0B7BC"},
  { id:"GB",abbreviation:"GB",city:"Green Bay",nickname:"Packers",fullName:"Green Bay Packers",conference:"NFC",division:"NFC North",logo:"/logos/GB.png",primaryColor:"#203731",secondaryColor:"#FFB612"},
  { id:"MIN",abbreviation:"MIN",city:"Minnesota",nickname:"Vikings",fullName:"Minnesota Vikings",conference:"NFC",division:"NFC North",logo:"/logos/MIN.png",primaryColor:"#4F2683",secondaryColor:"#FFC62F"},

  // NFC SOUTH
  { id:"ATL",abbreviation:"ATL",city:"Atlanta",nickname:"Falcons",fullName:"Atlanta Falcons",conference:"NFC",division:"NFC South",logo:"/logos/ATL.png",primaryColor:"#A71930",secondaryColor:"#000000"},
  { id:"CAR",abbreviation:"CAR",city:"Carolina",nickname:"Panthers",fullName:"Carolina Panthers",conference:"NFC",division:"NFC South",logo:"/logos/CAR.png",primaryColor:"#0085CA",secondaryColor:"#101820"},
  { id:"NO",abbreviation:"NO",city:"New Orleans",nickname:"Saints",fullName:"New Orleans Saints",conference:"NFC",division:"NFC South",logo:"/logos/NO.png",primaryColor:"#D3BC8D",secondaryColor:"#101820"},
  { id:"TB",abbreviation:"TB",city:"Tampa Bay",nickname:"Buccaneers",fullName:"Tampa Bay Buccaneers",conference:"NFC",division:"NFC South",logo:"/logos/TB.png",primaryColor:"#D50A0A",secondaryColor:"#34302B"},

  // NFC WEST
  { id:"ARI",abbreviation:"ARI",city:"Arizona",nickname:"Cardinals",fullName:"Arizona Cardinals",conference:"NFC",division:"NFC West",logo:"/logos/ARI.png",primaryColor:"#97233F",secondaryColor:"#000000"},
  { id:"LAR",abbreviation:"LAR",city:"Los Angeles",nickname:"Rams",fullName:"Los Angeles Rams",conference:"NFC",division:"NFC West",logo:"/logos/LAR.png",primaryColor:"#003594",secondaryColor:"#FFD100"},
  { id:"SF",abbreviation:"SF",city:"San Francisco",nickname:"49ers",fullName:"San Francisco 49ers",conference:"NFC",division:"NFC West",logo:"/logos/SF.png",primaryColor:"#AA0000",secondaryColor:"#B3995D"},
  { id:"SEA",abbreviation:"SEA",city:"Seattle",nickname:"Seahawks",fullName:"Seattle Seahawks",conference:"NFC",division:"NFC West",logo:"/logos/SEA.png",primaryColor:"#002244",secondaryColor:"#69BE28"},
];