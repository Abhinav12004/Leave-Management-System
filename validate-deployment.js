#!/usr/bin/env node

/**
 * Deployment Validation Script
 * 
 * This script validates that the application is ready for deployment
 * by checking all critical components and configurations.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class DeploymentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.successes = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    if (type === 'success') this.successes.push(message);
    if (type === 'warning') this.warnings.push(message);
    if (type === 'error') this.errors.push(message);
  }

  async validateFileStructure() {
    this.log('🔍 Validating project structure...', 'info');
    
    const requiredFiles = [
      'package.json',
      'index.js',
      'test-page.html',
      'README.md'
    ];
    
    const requiredDirs = [
      'controllers',
      'routes',
      'models',
      'config'
    ];
    
    for (const file of requiredFiles) {
      if (fs.existsSync(file)) {
        this.log(`Required file '${file}' found`, 'success');
      } else {
        this.log(`Required file '${file}' missing`, 'error');
      }
    }
    
    for (const dir of requiredDirs) {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        this.log(`Required directory '${dir}' found`, 'success');
      } else {
        this.log(`Required directory '${dir}' missing`, 'error');
      }
    }
  }

  async validatePackageJson() {
    this.log('📦 Validating package.json...', 'info');
    
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Check required fields
      const requiredFields = ['name', 'version', 'main', 'scripts'];
      for (const field of requiredFields) {
        if (pkg[field]) {
          this.log(`Package field '${field}' present: ${JSON.stringify(pkg[field])}`, 'success');
        } else {
          this.log(`Package field '${field}' missing`, 'error');
        }
      }
      
      // Check scripts
      const requiredScripts = ['start'];
      for (const script of requiredScripts) {
        if (pkg.scripts && pkg.scripts[script]) {
          this.log(`Script '${script}' configured: ${pkg.scripts[script]}`, 'success');
        } else {
          this.log(`Script '${script}' missing`, 'error');
        }
      }
      
      // Check dependencies
      const criticalDeps = ['express', '@supabase/supabase-js'];
      for (const dep of criticalDeps) {
        if (pkg.dependencies && pkg.dependencies[dep]) {
          this.log(`Critical dependency '${dep}' found: ${pkg.dependencies[dep]}`, 'success');
        } else {
          this.log(`Critical dependency '${dep}' missing`, 'error');
        }
      }
      
    } catch (error) {
      this.log(`Failed to parse package.json: ${error.message}`, 'error');
    }
  }

  async validateServerFile() {
    this.log('🚀 Validating server configuration...', 'info');
    
    try {
      const serverContent = fs.readFileSync('index.js', 'utf8');
      
      // Check for required configurations
      const checks = [
        { pattern: /require\(['"]express['"]\)/, message: 'Express import found' },
        { pattern: /app\.listen\(/, message: 'Server listen configuration found' },
        { pattern: /process\.env\.PORT/, message: 'Environment port configuration found' },
        { pattern: /test-page\.html/, message: 'Root page configuration found' }
      ];
      
      for (const check of checks) {
        if (check.pattern.test(serverContent)) {
          this.log(check.message, 'success');
        } else {
          this.log(`Missing: ${check.message}`, 'warning');
        }
      }
      
      // Test syntax
      try {
        require('./index.js');
        this.log('Server file syntax validation passed', 'success');
      } catch (error) {
        this.log(`Server file syntax error: ${error.message}`, 'error');
      }
      
    } catch (error) {
      this.log(`Failed to validate server file: ${error.message}`, 'error');
    }
  }

  async validateTestPage() {
    this.log('🌐 Validating test page...', 'info');
    
    try {
      if (fs.existsSync('test-page.html')) {
        const content = fs.readFileSync('test-page.html', 'utf8');
        
        // Check for essential elements
        const checks = [
          { pattern: /<html/i, message: 'Valid HTML structure' },
          { pattern: /<title/i, message: 'Page title present' },
          { pattern: /api.*test/i, message: 'API testing interface detected' },
          { pattern: /javascript/i, message: 'JavaScript functionality present' }
        ];
        
        for (const check of checks) {
          if (check.pattern.test(content)) {
            this.log(check.message, 'success');
          } else {
            this.log(`Test page missing: ${check.message}`, 'warning');
          }
        }
        
        this.log('Test page validation completed', 'success');
      } else {
        this.log('Test page file not found', 'error');
      }
    } catch (error) {
      this.log(`Failed to validate test page: ${error.message}`, 'error');
    }
  }

  async validateDependencies() {
    this.log('📚 Validating dependencies...', 'info');
    
    try {
      const { stdout } = await execAsync('npm ls --depth=0 --json');
      const deps = JSON.parse(stdout);
      
      if (deps.dependencies) {
        const depCount = Object.keys(deps.dependencies).length;
        this.log(`Found ${depCount} direct dependencies`, 'success');
        
        // Check for security vulnerabilities
        try {
          await execAsync('npm audit --audit-level moderate --json');
          this.log('No moderate or high security vulnerabilities found', 'success');
        } catch (auditError) {
          this.log('Some security vulnerabilities detected - review recommended', 'warning');
        }
      }
      
    } catch (error) {
      this.log('Dependency validation had issues - continuing anyway', 'warning');
    }
  }

  async validateEnvironment() {
    this.log('🔧 Validating environment configuration...', 'info');
    
    // Check Node.js version
    const nodeVersion = process.version;
    this.log(`Node.js version: ${nodeVersion}`, 'success');
    
    // Check npm version
    try {
      const { stdout } = await execAsync('npm --version');
      this.log(`npm version: ${stdout.trim()}`, 'success');
    } catch (error) {
      this.log('Failed to get npm version', 'warning');
    }
    
    // Platform compatibility
    this.log(`Platform: ${process.platform}`, 'success');
    this.log(`Architecture: ${process.arch}`, 'success');
  }

  async validateDeploymentReadiness() {
    this.log('🚀 Validating deployment readiness...', 'info');
    
    // Check for Render-specific configurations
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Check start script
      if (pkg.scripts && pkg.scripts.start) {
        if (pkg.scripts.start.includes('node index.js') || pkg.scripts.start.includes('npm start')) {
          this.log('Start script is Render-compatible', 'success');
        } else {
          this.log('Start script may need adjustment for Render', 'warning');
        }
      }
      
      // Check engines
      if (pkg.engines && pkg.engines.node) {
        this.log(`Node engine specified: ${pkg.engines.node}`, 'success');
      } else {
        this.log('No Node engine specified - Render will use default', 'warning');
      }
      
    } catch (error) {
      this.log('Failed to validate deployment configuration', 'warning');
    }
  }

  async generateReport() {
    this.log('\n📋 DEPLOYMENT VALIDATION REPORT', 'info');
    this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
    
    this.log(`\n✅ Successes: ${this.successes.length}`, 'info');
    this.log(`⚠️ Warnings: ${this.warnings.length}`, 'info');
    this.log(`❌ Errors: ${this.errors.length}`, 'info');
    
    if (this.errors.length > 0) {
      this.log('\n❌ CRITICAL ISSUES:', 'error');
      this.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (this.warnings.length > 0) {
      this.log('\n⚠️ WARNINGS:', 'warning');
      this.warnings.forEach(warning => console.log(`   • ${warning}`));
    }
    
    // Overall status
    if (this.errors.length === 0) {
      this.log('\n🎉 DEPLOYMENT STATUS: ✅ READY', 'success');
      this.log('Your application is ready for deployment to Render!', 'success');
      this.log('\nNext steps:', 'info');
      this.log('1. Push this code to your GitHub repository', 'info');
      this.log('2. Connect your repository to Render', 'info');
      this.log('3. Configure environment variables on Render dashboard', 'info');
      this.log('4. Deploy and test using the interactive test page', 'info');
    } else {
      this.log('\n🚫 DEPLOYMENT STATUS: ❌ NOT READY', 'error');
      this.log('Please fix the critical issues above before deploying.', 'error');
    }
    
    return this.errors.length === 0;
  }

  async validate() {
    console.log('🔍 Starting Deployment Validation...\n');
    
    await this.validateFileStructure();
    await this.validatePackageJson();
    await this.validateServerFile();
    await this.validateTestPage();
    await this.validateDependencies();
    await this.validateEnvironment();
    await this.validateDeploymentReadiness();
    
    return await this.generateReport();
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new DeploymentValidator();
  
  validator.validate()
    .then(isReady => {
      process.exit(isReady ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

module.exports = DeploymentValidator;
