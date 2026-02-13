export enum StandardType {
  // GRI 2: General Disclosures 2021
  GRI_2_1 = "GRI 2-1: 組織詳細資訊",
  GRI_2_2 = "GRI 2-2: 組織永續報導中包含的實體",
  GRI_2_3 = "GRI 2-3: 報導期間、頻率及聯絡人",
  GRI_2_4 = "GRI 2-4: 資訊重編",
  GRI_2_5 = "GRI 2-5: 外部保證/確信",
  GRI_2_6 = "GRI 2-6: 活動、價值鏈和其他商業關係",
  GRI_2_7 = "GRI 2-7: 員工",
  GRI_2_8 = "GRI 2-8: 非員工的工作者",
  GRI_2_9 = "GRI 2-9: 治理結構及組成",
  GRI_2_10 = "GRI 2-10: 最高治理單位的提名與遴選",
  GRI_2_11 = "GRI 2-11: 最高治理單位的主席",
  GRI_2_12 = "GRI 2-12: 最高治理單位於監督衝擊管理的角色",
  GRI_2_13 = "GRI 2-13: 衝擊管理的負責人",
  GRI_2_14 = "GRI 2-14: 最高治理單位於永續報導的角色",
  GRI_2_15 = "GRI 2-15: 利益衝突",
  GRI_2_16 = "GRI 2-16: 溝通關鍵重大事件",
  GRI_2_17 = "GRI 2-17: 最高治理單位的群體智識",
  GRI_2_18 = "GRI 2-18: 最高治理單位的績效評估",
  GRI_2_19 = "GRI 2-19: 薪酬政策",
  GRI_2_20 = "GRI 2-20: 薪酬決定流程",
  GRI_2_21 = "GRI 2-21: 年度總薪酬比率",
  GRI_2_22 = "GRI 2-22: 永續發展策略的聲明",
  GRI_2_23 = "GRI 2-23: 政策承諾",
  GRI_2_24 = "GRI 2-24: 納入政策承諾",
  GRI_2_25 = "GRI 2-25: 補救負面衝擊的程序",
  GRI_2_26 = "GRI 2-26: 尋求建議和提出疑慮的機制",
  GRI_2_27 = "GRI 2-27: 法規遵循",
  GRI_2_28 = "GRI 2-28: 公協會的會員資格",
  GRI_2_29 = "GRI 2-29: 利害關係人議合方針",
  GRI_2_30 = "GRI 2-30: 團體協約",

  // GRI 3: Material Topics 2021
  GRI_3_1 = "GRI 3-1: 決定重大主題的流程",
  GRI_3_2 = "GRI 3-2: 重大主題列表",
  GRI_3_3 = "GRI 3-3: 重大主題管理",

  // GRI 200 Series: Economic
  GRI_201_1 = "GRI 201-1: 組織所產生及分配的直接經濟價值",
  GRI_201_2 = "GRI 201-2: 氣候變遷所產生的財務影響及其它風險與機會",
  GRI_201_3 = "GRI 201-3: 確定給付制義務與其他退休計畫",
  GRI_201_4 = "GRI 201-4: 取自政府之財務援助",
  
  GRI_205_1 = "GRI 205-1: 已進行貪腐風險評估的營運據點",
  GRI_205_2 = "GRI 205-2: 有關反貪腐政策和程序的溝通及訓練",
  GRI_205_3 = "GRI 205-3: 已確認的貪腐事件及採取的行動",

  GRI_206_1 = "GRI 206-1: 反競爭行為、反托拉斯和壟斷行為的法律行動",

  // GRI 300 Series: Environmental
  GRI_301_1 = "GRI 301-1: 所用物料的重量或體積",
  GRI_301_2 = "GRI 301-2: 使用回收再利用的物料",
  GRI_301_3 = "GRI 301-3: 回收產品及其包材",

  GRI_302_1 = "GRI 302-1: 組織內部的能源消耗量",
  GRI_302_2 = "GRI 302-2: 組織外部的能源消耗量",
  GRI_302_3 = "GRI 302-3: 能源密集度",
  GRI_302_4 = "GRI 302-4: 減少能源消耗",
  GRI_302_5 = "GRI 302-5: 降低產品和服務的能源需求",

  GRI_303_1 = "GRI 303-1: 共享水資源之相互影響",
  GRI_303_2 = "GRI 303-2: 與排水相關衝擊的管理",
  GRI_303_3 = "GRI 303-3: 取水量",
  GRI_303_4 = "GRI 303-4: 排水量",
  GRI_303_5 = "GRI 303-5: 耗水量",

  GRI_305_1 = "GRI 305-1: 直接（範疇一）溫室氣體排放",
  GRI_305_2 = "GRI 305-2: 能源間接（範疇二）溫室氣體排放",
  GRI_305_3 = "GRI 305-3: 其它間接（範疇三）溫室氣體排放",
  GRI_305_4 = "GRI 305-4: 溫室氣體排放強度",
  GRI_305_5 = "GRI 305-5: 溫室氣體排放減量",
  GRI_305_6 = "GRI 305-6: 臭氧層破壞物質（ODS）的排放",
  GRI_305_7 = "GRI 305-7: 氮氧化物（NOx）、硫氧化物（SOx），及其它顯著的氣體排放",

  GRI_306_1 = "GRI 306-1: 廢棄物的產生與廢棄物相關顯著衝擊",
  GRI_306_2 = "GRI 306-2: 廢棄物相關顯著衝擊之管理",
  GRI_306_3 = "GRI 306-3: 廢棄物的產生",
  GRI_306_4 = "GRI 306-4: 廢棄物的處置移轉",
  GRI_306_5 = "GRI 306-5: 廢棄物的直接處置",

  // GRI 400 Series: Social
  GRI_401_1 = "GRI 401-1: 新進員工和離職員工",
  GRI_401_2 = "GRI 401-2: 提供給全職員工的福利",
  GRI_401_3 = "GRI 401-3: 育嬰假",

  GRI_402_1 = "GRI 402-1: 關於營運變化的最短預告期",

  GRI_403_1 = "GRI 403-1: 職業安全衛生管理系統",
  GRI_403_2 = "GRI 403-2: 危害辨識、風險評估及事故調查",
  GRI_403_3 = "GRI 403-3: 職業健康服務",
  GRI_403_4 = "GRI 403-4: 有關職業安全衛生之工作者參與、諮詢與溝通",
  GRI_403_5 = "GRI 403-5: 有關職業安全衛生之工作者訓練",
  GRI_403_6 = "GRI 403-6: 工作者健康促進",
  GRI_403_7 = "GRI 403-7: 預防和減緩與業務關係直接相關聯之職業安全衛生的衝擊",
  GRI_403_8 = "GRI 403-8: 職業安全衛生管理系統所涵蓋之工作者",
  GRI_403_9 = "GRI 403-9: 職業傷害",
  GRI_403_10 = "GRI 403-10: 職業病",

  GRI_404_1 = "GRI 404-1: 每名員工每年接受訓練的平均時數",
  GRI_404_2 = "GRI 404-2: 提升員工職能及過渡協助方案",
  GRI_404_3 = "GRI 404-3: 定期接受績效及職業發展檢核的員工百分比",

  GRI_405_1 = "GRI 405-1: 治理單位與員工的多元化",
  GRI_405_2 = "GRI 405-2: 女性對男性基本薪資與薪酬的比率",

  GRI_418_1 = "GRI 418-1: 經證實侵犯客戶隱私或遺失客戶資料的投訴"
}

export interface KnowledgeChunk {
  id: string;
  text: string;
  metadata: {
    source: string;
    section: string;
    topic: string;
  };
}

export interface ReportState {
  rawInput: string;
  selectedStandard: StandardType;
  generatedReport: string | null;
  retrievedContext: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isSystem?: boolean; // For messages like "Report updated"
}