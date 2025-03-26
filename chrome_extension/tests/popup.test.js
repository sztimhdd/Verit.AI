class PopupTester {
  static async testAllStates() {
    const tests = [
      this.testInitialState,
      this.testServiceReady,
      this.testServiceError,
      this.testAnalyzing,
      this.testErrorHandling,
      this.testLanguageSwitch
    ];

    for (const test of tests) {
      try {
        await test();
        console.log(`✅ ${test.name} passed`);
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error);
      }
    }
  }

  static async testInitialState() {
    const popup = new PopupManager();
    assert(popup.state.serviceStatus === 'initializing', 'Initial state should be initializing');
    assert(popup.state.isAnalyzing === false, 'Should not be analyzing initially');
    assert(popup.state.lastError === null, 'Should have no initial error');
  }

  static async testServiceReady() {
    const popup = new PopupManager();
    await popup.updateServiceStatus('ready');
    assert(popup.elements.analyzeButton.disabled === false, 'Analyze button should be enabled');
    assert(popup.elements.statusIcon.classList.contains('ready'), 'Status icon should show ready');
  }

  static async testServiceError() {
    const popup = new PopupManager();
    await popup.updateServiceStatus('error');
    assert(popup.elements.analyzeButton.disabled === true, 'Analyze button should be disabled');
    assert(popup.elements.statusIcon.classList.contains('error'), 'Status icon should show error');
  }

  static async testAnalyzing() {
    const popup = new PopupManager();
    await popup.setState({ isAnalyzing: true });
    assert(popup.elements.loadingIndicator.classList.contains('hidden') === false, 'Loading indicator should be visible');
    assert(popup.elements.analyzeButton.disabled === true, 'Analyze button should be disabled while analyzing');
  }

  static async testErrorHandling() {
    const popup = new PopupManager();
    const testError = 'Test error message';
    await popup.handleAnalysisError({ message: testError });
    assert(popup.elements.errorSection.classList.contains('hidden') === false, 'Error section should be visible');
    assert(popup.elements.errorMessage.textContent === testError, 'Error message should be displayed');
  }

  static async testLanguageSwitch() {
    const popup = new PopupManager();
    // Test English
    await popup.i18n.setLanguage('en');
    assert(document.querySelector('[data-i18n="analyze"]').textContent === 'Analyze', 'Should show English text');
    // Test Chinese
    await popup.i18n.setLanguage('zh');
    assert(document.querySelector('[data-i18n="analyze"]').textContent === '开始核查', 'Should show Chinese text');
  }

  static async testPerformance() {
    const popup = new PopupManager();
    const startTime = performance.now();
    await popup.initialize();
    const initTime = performance.now() - startTime;
    assert(initTime < 1000, 'Initialization should complete within 1 second');
  }

  static async testStateTransitions() {
    const popup = new PopupManager();
    const transitions = [];
    
    // 记录状态转换
    popup.setState = new Proxy(popup.setState, {
      apply: (target, thisArg, args) => {
        transitions.push(args[0]);
        return target.apply(thisArg, args);
      }
    });

    // 测试状态转换序列
    await popup.initialize();
    await popup.handleAnalyzeClick();
    await popup.handleAnalysisComplete();
    
    assert(transitions.length === 3, 'Should go through all state transitions');
  }

  static async testApiResponseValidation() {
    const popup = new PopupManager();
    
    // 测试完整的API响应格式
    const validResponse = {
      score: 85,
      flags: {
        factuality: "高",
        objectivity: "中",
        reliability: "高",
        bias: "低"
      },
      source_verification: {
        sources_found: ["示例来源"],
        credibility_scores: [8],
        overall_source_credibility: "高"
      },
      entity_verification: {
        entities_found: ["示例实体"],
        accuracy_assessment: "高",
        corrections: []
      },
      fact_check: {
        claims_identified: ["示例声明"],
        verification_results: ["真实"],
        overall_factual_accuracy: "高"
      },
      exaggeration_check: {
        exaggerations_found: [],
        corrections: [],
        severity_assessment: "低"
      },
      summary: "示例摘要",
      sources: [{ title: "示例来源", url: "https://example.com" }]
    };

    try {
      popup.validateApiResponse(validResponse);
      console.log("✅ Valid API response validation passed");
    } catch (error) {
      throw new Error("Valid API response validation failed: " + error.message);
    }

    // 测试缺失字段
    const invalidResponse = { ...validResponse };
    delete invalidResponse.score;
    
    try {
      popup.validateApiResponse(invalidResponse);
      throw new Error("Invalid API response validation should fail");
    } catch (error) {
      assert(error.message.includes("Missing required field"), 
        "Should detect missing required field");
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
} 