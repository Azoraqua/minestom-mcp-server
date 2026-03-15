export function normalizeText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

export function tokenize(value: string): string[] {
	return normalizeText(value).split(/\s+/).filter(Boolean);
}

export function scoreTextQuery(query: string, fields: string[]): number {
	const normalizedQuery = normalizeText(query);

	if (!normalizedQuery) {
		return 0;
	}

	const queryTokens = tokenize(query);

	return fields.reduce((score, field) => {
		const normalizedField = normalizeText(field);

		if (!normalizedField) {
			return score;
		}

		let nextScore = score;

		if (normalizedField === normalizedQuery) {
			nextScore += 120;
		} else if (normalizedField.startsWith(normalizedQuery)) {
			nextScore += 80;
		} else if (normalizedField.includes(normalizedQuery)) {
			nextScore += 50;
		}

		for (const token of queryTokens) {
			if (normalizedField === token) {
				nextScore += 30;
			} else if (normalizedField.includes(token)) {
				nextScore += 12;
			}
		}

		return nextScore;
	}, 0);
}

export function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
	const seen = new Set<string>();

	return items.filter((item) => {
		const key = keyFn(item);

		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
}
