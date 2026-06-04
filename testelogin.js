const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

async function main() {
  const options = new chrome.Options();
  options.excludeSwitches("enable-logging");
  options.addArguments("--log-level=3");
  options.addArguments("--silent");

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  try {
    await driver.get('file:///C:/Users/franc/OneDrive/Documentos/P2/public/html/login.html');
    await driver.manage().window().maximize();

    const email = await driver.wait(
      until.elementLocated(By.id('emailInput')),
      10000
    );

    const password = await driver.findElement(By.id('passwordInput'));
    const button = await driver.findElement(By.css("button[type='submit']"));

    await email.sendKeys('user@glowpath.com');
    await driver.sleep(5000);
    await password.sendKeys('user123');
    await driver.sleep(5000);
    await button.click();

    await driver.wait(until.urlContains('dashboard.html'), 10000);

    const pageTitle = await driver.findElement(By.css('.page-title'));
    console.log('Login successful —', await pageTitle.getText());
  } finally {
    await driver.quit();
  }
}

main().catch(console.error);