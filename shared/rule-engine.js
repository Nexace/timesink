/**
 * Shared Escalating Rule Engine
 * Used by The Diet Game and The Resume Game
 */

export function createRuleEngine(rulesDefinitions, { onFail = null, onPassRule = null } = {}) {
  let unlockedIndex = 1; // start with rule 1 unlocked
  let isFailed = false;
  let failReason = "";

  return {
    get totalRules() {
      return rulesDefinitions.length;
    },
    get unlockedCount() {
      return unlockedIndex;
    },
    get isFailed() {
      return isFailed;
    },
    get failReason() {
      return failReason;
    },
    triggerFail(reason) {
      isFailed = true;
      failReason = reason;
      onFail?.(reason);
    },
    reset() {
      unlockedIndex = 1;
      isFailed = false;
      failReason = "";
    },
    evaluate(text = "", context = {}) {
      if (isFailed) {
        return {
          failed: true,
          failReason,
          unlockedCount: unlockedIndex,
          total: rulesDefinitions.length,
          results: [],
        };
      }

      // Check external fail conditions on unlocked rules
      for (let i = 0; i < unlockedIndex; i += 1) {
        const rule = rulesDefinitions[i];
        if (typeof rule.failCheck === "function") {
          const failMsg = rule.failCheck(context);
          if (failMsg) {
            isFailed = true;
            failReason = failMsg;
            onFail?.(failMsg);
            return {
              failed: true,
              failReason,
              unlockedCount: unlockedIndex,
              total: rulesDefinitions.length,
              results: [],
            };
          }
        }
      }

      const results = [];
      let allUnlockedPassed = true;

      for (let i = 0; i < unlockedIndex; i += 1) {
        const rule = rulesDefinitions[i];
        let passed = false;
        let note = "";
        try {
          const res = rule.test(text, context);
          if (typeof res === "boolean") {
            passed = res;
          } else if (res && typeof res === "object") {
            passed = Boolean(res.pass);
            note = res.note || "";
          }
        } catch (err) {
          passed = false;
          note = err.message;
        }

        results.push({
          id: rule.id,
          order: rule.order ?? i + 1,
          label: rule.label,
          passed,
          note,
        });

        if (!passed) {
          allUnlockedPassed = false;
        }
      }

      // If all currently unlocked rules passed, advance to the next rule
      if (allUnlockedPassed && unlockedIndex < rulesDefinitions.length) {
        unlockedIndex += 1;
        onPassRule?.(unlockedIndex);
        // Re-evaluate to include the newly unlocked rule
        return this.evaluate(text, context);
      }

      const passedCount = results.filter((r) => r.passed).length;
      const completedAll = allUnlockedPassed && unlockedIndex === rulesDefinitions.length;

      return {
        failed: false,
        completedAll,
        unlockedCount: unlockedIndex,
        passedCount,
        total: rulesDefinitions.length,
        results,
      };
    },
  };
}
