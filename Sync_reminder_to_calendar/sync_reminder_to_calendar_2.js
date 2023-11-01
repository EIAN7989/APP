//要同步的时间段，当前时间前后n个月
var dur_month = 2;

const startDate = new Date();
startDate.setMonth(startDate.getMonth() - dur_month);
console.log(`日历的开始时间 ${startDate.toLocaleDateString()}`);

const endDate = new Date();
endDate.setMonth(endDate.getMonth() + dur_month);
console.log(`日历的结束时间 ${endDate.toLocaleDateString()}`);

const reminders = await Reminder.allDueBetween(startDate, endDate);
console.log(`获取 ${reminders.length} 条提醒事项`);

var calendar = await Calendar.forEvents();

//获取日历名和对应的日历
var m_dict = {};
for (cal of calendar) {
	m_dict[cal.title] = cal;
	//console.log(`日历:${cal.title}`)
}

const events = await CalendarEvent.between(startDate, endDate, calendar);
console.log(`获取 ${events.length} 条日历`);

for (const reminder of reminders) {
	reminder.notes =
		!reminder.notes || reminder.notes == null || reminder.notes == "undefined"
			? "无"
			: reminder.notes;
	//const targetNote = `[Reminder] ${reminder.identifier}`
	const options = { year: "numeric", month: "2-digit", day: "2-digit" };
	// 备注中要添加的提醒事项创建时间
	const _creationDate = reminder.creationDate
		.toLocaleTimeString("zh-CN", options)
		.replace(/\//g, ".");
	// 备注中要添加的提醒事项完成时间
	// const _completionDate = (reminder.completionDate == null && reminder.isCompleted == false) ? ' ' : `完成：${reminder.completionDate.toLocaleTimeString('zh-CN', options).replace(/\//g, '.')}`
	// 要同步到日历备注的提醒事项信息
	// const targetNote = `同步自提醒事项👇\n列表：${reminder.calendar.title}\n标题：${reminder.title}\n创建：${_creationDate}\n${_completionDate}`
	const targetNote = `同步自提醒事项👇\n列表：${reminder.calendar.title}\n标题：${reminder.title}\n创建：${_creationDate}`;
	// 过滤重复的reminder
	const [targetEvent] = events.filter(
		(e) => e.notes != null && e.notes.indexOf(targetNote) != -1
	);

	if (!m_dict[reminder.calendar.title]) {
		console.warn("找不到日历" + reminder.calendar.title);
		continue;
	}

	if (targetEvent) {
		//console.log(`找到已经创建的事项 ${reminder.title}`)
		updateEvent(targetEvent, reminder);
	} else {
		console.warn(
			`同步提醒事项【${reminder.title}】到日历【${reminder.calendar.title}】`
		);
		const newEvent = new CalendarEvent();
		// 日历备注
		newEvent.notes = reminder.notes + "\n\n" + targetNote; //要加入备注
		updateEvent(newEvent, reminder);
	}
}

Script.complete();

//设置period
function setPeriod(event, period, description) {
	const supplement =
		description == "延期" || description == "提前" ? "完成" : "";
	if (period < 3600) {
		return (subHeading =
			Math.floor((period / 60).toFixed(1)) == 0
				? `准时完成`
				: `${description}${(period / 60).toFixed()}分钟${supplement}`);
	} else if (period >= 3600 && period <= 3600 * 24) {
		return (subHeading =
			((period % 3600) / 60).toFixed() == 0
				? `${description}${(period / 3600).toFixed()}小时${supplement}`
				: `${description}${Math.floor((period / 3600).toFixed(2))}小时${(
						(period % 3600) /
						60
				  ).toFixed()}分钟${supplement}`);
	} else {
		return (subHeading =
			((period % (3600 * 24)) / 3600).toFixed() == 0
				? `${description}${(period / 3600 / 24).toFixed()}天${supplement}`
				: `${description}${(period / 3600 / 24).toFixed()}天${(
						(period % (3600 * 24)) /
						3600
				  ).toFixed()}小时${supplement}`);
	}
}

//日历中创建提醒
function updateEvent(event, reminder) {
	cal_name = reminder.calendar.title;
	cal = m_dict[cal_name];
	event.calendar = cal;
	// console.warn(event.calendar.title)
	// 已完成事项
	if (reminder.isCompleted) {
		event.isAllDay = false;
		event.startDate = reminder.dueDate;
		event.endDate = reminder.completionDate;
		var period = (reminder.dueDate - reminder.completionDate) / 1000;
		period = period.toFixed();
		if (period < 0) {
			period = -period;
			let titleTail = setPeriod(event, period, "延期");
			event.title = `✅${reminder.title} (${titleTail})`;
		} else if (period == 0) {
			event.title = `✅${reminder.title} (准时完成)`;
		} else {
			let titleTail = setPeriod(event, period, "提前");
			event.title = `✅${reminder.title} (${titleTail})`;
			event.endDate = reminder.dueDate;
			event.startDate = reminder.completionDate;
		}
	}
	// 未完成事项
	else {
		const nowtime = new Date();
		var period = (reminder.dueDate - nowtime) / 1000;
		period = period.toFixed();
		if (period < 0) {
			// 待办顺延
			period = -period;
			let titleTail = setPeriod(event, period, "已延期");
			// 如果不是在同一天,设置为全天事项
			if (reminder.dueDate.getDate() != nowtime.getDate()) {
				event.title = `❌${reminder.title} (${titleTail})`;
				event.startDate = nowtime;
				event.endDate = nowtime;
				event.isAllDay = true;
			}
			// 在同一天的保持原来的时间
			else {
				event.title = `⭕️${reminder.title} (${titleTail})`;
				event.isAllDay = false;
				event.startDate = reminder.dueDate;
				event.endDate = nowtime;
			}
		} else {
			event.isAllDay = false;
			let titleTail = setPeriod(event, period, "还剩");
			event.title = `⭕️${reminder.title} (${titleTail})`;
			event.startDate = reminder.dueDate;
			event.endDate = reminder.dueDate;
		}
	}
	event.save();
}