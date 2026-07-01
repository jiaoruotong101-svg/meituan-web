/**
 * Seed script for Meituan Hotel Crawler Dashboard
 * Inserts ~50 mock hotels across Beijing / Shanghai / Tianjin,
 * 3 crawl sessions, and 2 alerts. Idempotent: skips if data exists.
 *
 * Run with: bun run scripts/seed-hotels.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type HotelSeed = {
  hotelId: string;
  city: string;
  name: string;
  hotelType: string[];
  score: number;
  scoreLabel: string;
  reviewQuote: string;
  locationDesc: string;
  tags: string[];
  lowStockAlert?: string;
  originalPrice: number;
  currentPrice: number;
  consumptionCount: string;
  bookingStatus: string;
  promotions: string[];
  address: string;
  openYear: string;
  decorateYear: string;
  starLevel: string;
  facilities: string[];
  nearbyPois: string[];
  commentCount: number;
  imageCount: number;
  searchKeyword: string;
  checkinDate: string;
  checkoutDate: string;
  crawlTimeOffsetHours: number; // hours ago
};

// ---- Helpers --------------------------------------------------------------
const pick = <T,>(arr: T[], i: number): T => arr[i % arr.length];

const facilitiesPool = [
  "免费Wifi", "免费停车", "前台保险箱", "行李寄存", "电梯",
  "叫醒服务", "24小时热水", "空调", "吹风机", "拖鞋",
  "洗衣服务", "商务中心", "会议室", "餐厅", "健身房",
];

const tagPool = [
  "高性价比", "近地铁", "亲子", "商务出差", "情侣出行",
  "免费早餐", "免费取消", "闪住", "到店付", "酒店红包",
];

const promoPool = [
  "立减10元", "连住优惠", "新客首单立减30", "会员价", "返现5%",
];

const reviewQuotes = [
  "设施设备都特别齐全，房间干净整洁",
  "位置很好找，离地铁口近，出行方便",
  "前台服务态度很好，环境优雅",
  "性价比超高，下次还会再来",
  "隔音效果不错，睡得很舒服",
  "卫生干净，布置温馨，强烈推荐",
];

// ---- Hotel generator ------------------------------------------------------
function buildHotel(
  index: number,
  city: string,
  searchKeyword: string,
  name: string,
  address: string,
  crawlTimeOffsetHours: number,
): HotelSeed {
  const priceTier = (index % 4) as 0 | 1 | 2 | 3;
  const basePrice = [60, 180, 420, 880][priceTier];
  const discount = 0.7 + (index % 4) * 0.05; // 0.7 - 0.85
  const currentPrice = Math.round(basePrice * discount);
  const hotelTypesByTier = [
    ["经济型", "客栈"],
    ["舒适型", "连锁酒店"],
    ["高档型", "商务酒店"],
    ["豪华型", "五星酒店"],
  ];
  const scoreBase = [4.2, 4.5, 4.7, 4.8][priceTier];
  const score = Math.round((scoreBase + (index % 5) * 0.02) * 100) / 100;
  const scoreLabel =
    score >= 4.8 ? "超棒" : score >= 4.6 ? "很棒" : score >= 4.3 ? "棒" : "不错";

  const facilityCount = 6 + (index % 5);
  const facilities = Array.from(
    { length: facilityCount },
    (_, i) => pick(facilitiesPool, i + index),
  ).filter((v, i, arr) => arr.indexOf(v) === i);

  const tagCount = 3 + (index % 3);
  const tags = Array.from(
    { length: tagCount },
    (_, i) => pick(tagPool, i + index * 3),
  ).filter((v, i, arr) => arr.indexOf(v) === i);

  const promoCount = 1 + (index % 3);
  const promotions = Array.from(
    { length: promoCount },
    (_, i) => pick(promoPool, i + index * 2),
  ).filter((v, i, arr) => arr.indexOf(v) === i);

  const consumption = (200 + index * 137) % 9000;

  return {
    hotelId: `${city}-H${String(index).padStart(4, "0")}`,
    city,
    name,
    hotelType: hotelTypesByTier[priceTier],
    score,
    scoreLabel,
    reviewQuote: pick(reviewQuotes, index),
    locationDesc: `近${searchKeyword}`,
    tags,
    lowStockAlert: index % 5 === 0 ? `低价房仅剩${1 + (index % 5)}间` : undefined,
    originalPrice: basePrice,
    currentPrice,
    consumptionCount: `${consumption}+消费`,
    bookingStatus: `${(index % 30) + 1}分钟前有人预订`,
    promotions,
    address,
    openYear: `${2010 + (index % 14)}年开业`,
    decorateYear: `${2020 + (index % 5)}年装修`,
    starLevel: ["经济型", "舒适型", "高档型", "五星级"][priceTier],
    facilities,
    nearbyPois: [searchKeyword, "地铁站", "便利店", "公交站"].slice(0, 2 + (index % 3)),
    commentCount: 80 + (index * 37) % 4500,
    imageCount: 20 + (index * 3) % 80,
    searchKeyword,
    checkinDate: "12.20",
    checkoutDate: "12.21",
    crawlTimeOffsetHours,
  };
}

// ---- Hotel definitions ----------------------------------------------------
const hotelNamesByCity: Record<string, string[]> = {
  北京: [
    "北京王府井希尔顿酒店", "北京建国饭店", "北京万达索菲特大酒店",
    "北京三里屯通盈中心洲际酒店", "北京中关村皇冠假日酒店",
    "北京西单美居酒店", "北京东直门亚朵酒店", "北京南站如家精选",
    "北京国贸桔子水晶酒店", "北京颐和园旁轻奢民宿", "北京五道口汉庭酒店",
    "北京亦庄智选假日酒店", "北京望京凯悦酒店", "北京首都机场朗豪酒店",
    "北京雍和宫智选酒店", "北京天坛南门锦江之星", "北京朝阳区全季酒店",
    "北京奥林匹克公园旁丽枫酒店",
  ],
  上海: [
    "上海外滩华尔道夫酒店", "上海和平饭店", "上海浦东丽思卡尔顿酒店",
    "上海南京路大酒店", "上海徐家汇美爵酒店", "上海虹桥万豪酒店",
    "上海陆家嘴洲际酒店", "上海迪士尼乐园酒店", "上海静安寺亚朵酒店",
    "上海五角场凯悦酒店", "上海莘庄喜来登酒店", "上海人民广场全季酒店",
    "上海世纪公园雅居乐酒店", "上海虹桥火车站桔子水晶", "上海豫园旁花间堂",
    "上海交通大学旁如家", "上海金桥智选假日酒店",
  ],
  天津: [
    "天津丽思卡尔顿酒店", "天津瑞吉金融街酒店", "天津滨江道万豪酒店",
    "天津意式风情区精品民宿", "天津古文化街锦江之星", "天津滨海喜来登酒店",
    "天津站亚朵酒店", "天津五大道公馆酒店", "天津海河悦榕庄",
    "天津水上公园智选假日", "天津卫津路如家", "天津南开大学全季酒店",
    "天津滨海机场朗豪酒店", "天津鼓楼旁花筑民宿", "天津河西区希尔顿酒店",
  ],
};

const hotelAddressesByCity: Record<string, string[]> = {
  北京: [
    "北京市东城区王府井大街8号", "北京市朝阳区建国门外大街5号",
    "北京市朝阳区建国路93号", "北京市朝阳区三里屯路1号",
    "北京市海淀区中关村大街27号", "北京市西城区西单北大街30号",
    "北京市东城区东直门外大街48号", "北京市丰台区永外大街车站路12号",
    "北京市朝阳区建国门外大街6号", "北京市海淀区颐和园路15号",
    "北京市海淀区五道口成府路28号", "北京市大兴区亦庄荣华中路18号",
    "北京市朝阳区望京东路6号", "北京市顺义区首都机场3号航站楼",
    "北京市东城区雍和宫大街52号", "北京市东城区天坛路77号",
    "北京市朝阳区光华路甲12号", "北京市朝阳区林萃路2号",
  ],
  上海: [
    "上海市黄浦区中山东一路2号", "上海市黄浦区南京东路20号",
    "上海市浦东新区世纪大道8号", "上海市黄浦区南京东路100号",
    "上海市徐汇区漕溪北路120号", "上海市长宁区虹桥路2270号",
    "上海市浦东新区张杨路777号", "上海市浦东新区川沙镇川沙路500号",
    "上海市静安区南京西路1788号", "上海市杨浦区淞沪路303号",
    "上海市闵行区莘庄地铁站南广场", "上海市黄浦区人民大道100号",
    "上海市浦东新区芳甸路666号", "上海市闵行区申虹路9号",
    "上海市黄浦区安仁街218号", "上海市徐汇区华山路1954号",
    "上海市浦东新区新金桥路18号",
  ],
  天津: [
    "天津市和平区大沽北路167号", "天津市和平区张自忠路158号",
    "天津市和平区南京路189号", "天津市河北区意式风情区光复道39号",
    "天津市南开区古文化街宫北大街12号", "天津市滨海新区第二大街50号",
    "天津市河东区天津站后广场", "天津市和平区马场道178号",
    "天津市河北区海河东路34号", "天津市南开区水上公园西路6号",
    "天津市南开区卫津路92号", "天津市南开区卫津路150号",
    "天津市东丽区滨海国际机场内", "天津市南开区城厢中路鼓楼商业街",
    "天津市河西区友谊路28号",
  ],
};

const cityKeywords: Record<string, string[]> = {
  北京: ["北京站", "王府井", "三里屯", "中关村", "西单"],
  上海: ["外滩", "陆家嘴", "南京路", "徐家汇", "虹桥"],
  天津: ["天津站", "意式风情区", "滨江道", "古文化街", "滨海"],
};

const hotelDefs: Array<{
  city: string;
  searchKeyword: string;
  name: string;
  address: string;
  offsetHours: number;
}> = [];

(Object.keys(hotelNamesByCity) as Array<keyof typeof hotelNamesByCity>).forEach((city) => {
  hotelNamesByCity[city].forEach((name, i) => {
    hotelDefs.push({
      city,
      searchKeyword: cityKeywords[city][i % cityKeywords[city].length],
      name,
      address: hotelAddressesByCity[city][i],
      offsetHours: (i % 7) * 6 + (i % 3),
    });
  });
});

// ---- Main seed routine ----------------------------------------------------
async function main() {
  console.log("🔍 Checking existing data...");
  const existing = await db.hotel.count();
  if (existing > 0) {
    console.log(`✅ Database already has ${existing} hotels. Skipping seed.`);
    return;
  }

  console.log(`🏨 Inserting ${hotelDefs.length} mock hotels...`);
  const now = Date.now();
  for (let i = 0; i < hotelDefs.length; i++) {
    const def = hotelDefs[i];
    const seed = buildHotel(
      i + 1,
      def.city,
      def.searchKeyword,
      def.name,
      def.address,
      def.offsetHours,
    );
    const crawlTime = new Date(now - seed.crawlTimeOffsetHours * 3600_000);
    await db.hotel.create({
      data: {
        hotelId: seed.hotelId,
        city: seed.city,
        searchKeyword: seed.searchKeyword,
        checkinDate: seed.checkinDate,
        checkoutDate: seed.checkoutDate,
        name: seed.name,
        hotelType: JSON.stringify(seed.hotelType),
        score: seed.score,
        scoreLabel: seed.scoreLabel,
        reviewQuote: seed.reviewQuote,
        locationDesc: seed.locationDesc,
        tags: JSON.stringify(seed.tags),
        lowStockAlert: seed.lowStockAlert ?? null,
        originalPrice: seed.originalPrice,
        currentPrice: seed.currentPrice,
        consumptionCount: seed.consumptionCount,
        bookingStatus: seed.bookingStatus,
        promotions: JSON.stringify(seed.promotions),
        address: seed.address,
        openYear: seed.openYear,
        decorateYear: seed.decorateYear,
        starLevel: seed.starLevel,
        facilities: JSON.stringify(seed.facilities),
        nearbyPois: JSON.stringify(seed.nearbyPois),
        commentCount: seed.commentCount,
        imageCount: seed.imageCount,
        crawlTime,
      },
    });
    if ((i + 1) % 10 === 0) {
      console.log(`   ... ${i + 1}/${hotelDefs.length} inserted`);
    }
  }
  console.log(`✅ Inserted ${hotelDefs.length} hotels.`);

  // Crawl sessions
  console.log("📅 Inserting crawl sessions...");
  const sessionStarts = [
    { city: "北京", hoursAgo: 26, status: "completed", count: 18 },
    { city: "上海", hoursAgo: 14, status: "running", count: 11 },
    { city: "天津", hoursAgo: 6, status: "running", count: 8 },
  ];
  for (const s of sessionStarts) {
    const start = new Date(now - s.hoursAgo * 3600_000);
    const ended =
      s.status === "completed"
        ? new Date(start.getTime() + 90 * 60_000)
        : null;
    await db.crawlSession.create({
      data: {
        city: s.city,
        startedAt: start,
        endedAt: ended,
        hotelCount: s.count,
        targetCount: 200,
        status: s.status,
        checkinDate: "12.20",
        checkoutDate: "12.21",
      },
    });
  }
  console.log("✅ Inserted 3 crawl sessions.");

  // Alerts
  console.log("🚨 Inserting alerts...");
  await db.crawlAlert.create({
    data: {
      type: "captcha",
      message: "上海地区爬取过程中触发美团验证码拦截，已自动暂停 5 分钟后重试",
      city: "上海",
      resolved: false,
      createdAt: new Date(now - 2 * 3600_000),
    },
  });
  await db.crawlAlert.create({
    data: {
      type: "rate_limit",
      message: "天津接口请求频率超阈值，建议降低并发数到 2",
      city: "天津",
      resolved: false,
      createdAt: new Date(now - 30 * 60_000),
    },
  });
  console.log("✅ Inserted 2 alerts.");
  console.log("🌱 Seed complete!");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
