//要同步的时间段，当前时间前后n个月，例如，当前为5月，设置为2时，同步时间段为3～7月
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
}

const events = await CalendarEvent.between(startDate, endDate, calendar);
console.log(`获取 ${events.length} 条日历`);

for (const reminder of reminders) {
	reminder.notes =
		!reminder.notes || reminder.notes == null || reminder.notes == "undefined"
			? "无"
			: reminder.notes;
	//reminder的标识符
	const targetNote = `${reminder.identifier}`;

	const [targetEvent] = events.filter(
		(e) => e.notes != null && e.notes.indexOf(targetNote) != -1
	); //过滤重复的reminder
	if (!m_dict[reminder.calendar.title]) {
		console.warn("找不到日历" + reminder.calendar.title);
		continue;
	}
	if (targetEvent) {
		updateEvent(targetEvent, reminder);
	} else {
		console.warn(`创建事项 ${reminder.title} 到 ${reminder.calendar.title}`);
		const newEvent = new CalendarEvent();
		newEvent.notes = reminder.notes + "\n\n" + targetNote; //要加入备注

		updateEvent(newEvent, reminder);
	}
}

Script.complete();

//设置period
function setPeriod(reminder, period, description) {
	const supplement =
		description == "延期" || description == "提前" ? "完成" : "";
	if (period < 3600) {
		return Math.floor((period / 60).toFixed(1)) == 0
			? `准时完成`
			: `${description}${(period / 60).toFixed()}分钟${supplement}`;
	} else if (period >= 3600 && period <= 3600 * 24) {
		if (
			!reminder.dueDateIncludesTime &&
			reminder.dueDate.getDate() == new Date().getDate()
		) {
			return `已完成`;
		} else {
			return ((period % 3600) / 60).toFixed() == 0
				? `${description}${(period / 3600).toFixed()}小时${supplement}`
				: `${description}${Math.floor((period / 3600).toFixed(2))}小时${(
						(period % 3600) /
						60
				  ).toFixed()}分钟${supplement}`;
		}
	} else {
		if (!reminder.dueDateIncludesTime) {
			if (description == "已延期" || description == "延期") {
				return ((period % (3600 * 24)) / 3600).toFixed() == 0
					? `${description}${(period / 3600 / 24).toFixed() - 1}天${supplement}`
					: `${description}${(period / 3600 / 24).toFixed() - 1}天${(
							(period % (3600 * 24)) /
							3600
					  ).toFixed()}小时${supplement}`;
			} else {
				return ((period % (3600 * 24)) / 3600).toFixed() == 0
					? `${description}${(period / 3600 / 24).toFixed()}天${supplement}`
					: `${description}${(period / 3600 / 24).toFixed()}天${(
							(period % (3600 * 24)) /
							3600
					  ).toFixed()}小时${supplement}`;
			}
		} else {
			return ((period % (3600 * 24)) / 3600).toFixed() == 0
				? `${description}${(period / 3600 / 24).toFixed()}天${supplement}`
				: `${description}${(period / 3600 / 24).toFixed()}天${(
						(period % (3600 * 24)) /
						3600
				  ).toFixed()}小时${supplement}`;
		}
	}
}

//日历中创建提醒
function updateEvent(event, reminder) {
	cal_name = reminder.calendar.title;
	cal = m_dict[cal_name];
	event.calendar = cal;

	// 已完成事项
	if (reminder.isCompleted) {
		event.isAllDay = false;
		event.startDate = reminder.dueDate;
		event.endDate = reminder.completionDate;
		var period = (reminder.dueDate - reminder.completionDate) / 1000;
		period = period.toFixed();
		if (period < 0) {
			period = -period;
			let titleTail = setPeriod(reminder, period, "延期");
			event.title = `✅${reminder.title} (${titleTail})`;
		} else if (period == 0) {
			event.title = `✅${reminder.title} (准时完成)`;
		} else {
			let titleTail = setPeriod(reminder, period, "提前");
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
			let titleTail = setPeriod(reminder, period, "已延期");
			// 如果不是在同一天,设置为全天事项
			if (reminder.dueDate.getDate() != nowtime.getDate()) {
				event.title = `❌${reminder.title} (${titleTail})`;
				event.startDate = nowtime;
				event.endDate = nowtime;
				event.isAllDay = true;
			}
			// 在同一天的保持原来的时间
			else {
				if (!reminder.dueDateIncludesTime) {
					event.isAllDay = true;
					event.title = `⭕️${reminder.title}(待完成)`;
				} else {
					event.title = `⭕️${reminder.title} (${titleTail})`;
					event.isAllDay = false;
					event.startDate = reminder.dueDate;
					event.endDate = nowtime;
				}
			}
		} else {
			event.isAllDay = false;
			let titleTail = setPeriod(reminder, period, "还剩");
			event.title = reminder.dueDateIncludesTime
				? `⭕️${reminder.title} (${titleTail})`
				: `⭕️${reminder.title}(待完成)`;
			event.startDate = reminder.dueDate;
			event.endDate = reminder.dueDateIncludesTime
				? reminder.dueDate
				: new Date(reminder.dueDate.getTime() + 24 * 60 * 60 * 1000);
		}
	}
	event.save();
}