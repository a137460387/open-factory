/**
 * Batch command — groups multiple commands as a single undo step.
 */
export class BatchCommand {
    description;
    commands;
    constructor(description, commands) {
        this.description = description;
        this.commands = [...commands];
    }
    execute() {
        for (const cmd of this.commands) {
            cmd.execute();
        }
    }
    undo() {
        // Undo in reverse order
        for (let i = this.commands.length - 1; i >= 0; i--) {
            this.commands[i].undo();
        }
    }
}
/**
 * No-op command — placeholder for empty operations.
 */
export class NoOpCommand {
    description = '(no operation)';
    execute() { }
    undo() { }
}
//# sourceMappingURL=command.js.map