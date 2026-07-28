import { normalizeProjectSpeakers } from '../model';
export function mergeProjectSpeakers(existing, imported) {
    const next = normalizeProjectSpeakers(existing);
    const seen = new Set(next.map((speaker) => speaker.name.toLocaleLowerCase()));
    for (const speaker of imported) {
        const key = speaker.name.toLocaleLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        next.push(speaker);
    }
    return next;
}
//# sourceMappingURL=project-speakers.js.map