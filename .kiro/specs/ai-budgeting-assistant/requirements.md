# Requirements Document

## Introduction

An AI-powered personal budgeting assistant built for the AI BuildFest 2026 hackathon (Track 3: AI for Everyday Life). The system helps users manage personal finances by accepting financial data, classifying expenses, creating budgets, identifying spending patterns, and providing natural-language financial guidance. The solution prioritises practical functionality achievable within one week, with low API costs and responsible use disclaimers.

## Glossary

- **Assistant**: The AI-powered budgeting application that processes financial data and provides recommendations
- **User**: A person using the Assistant to manage their personal finances
- **Transaction**: A single income or expense entry containing at minimum an amount, date, and description
- **Category**: A classification label for a Transaction (e.g., Groceries, Transport, Entertainment, Utilities, Housing)
- **Budget**: A planned allocation of income across Categories for a defined period (weekly or monthly)
- **Savings_Goal**: A target amount the User wants to save, with an optional deadline
- **Financial_Commitment**: A recurring obligation such as rent, loan repayment, or subscription
- **Budget_Period**: A weekly or monthly time window used for budget tracking
- **Spending_Alert**: A notification triggered when spending in a Category approaches or exceeds the budgeted amount
- **Financial_Summary**: A plain-language overview of the User's financial position for a given period
- **LLM**: The large language model used to power natural-language interactions and classification

## Requirements

### Requirement 1: Financial Data Input

**User Story:** As a User, I want to enter or upload my income, expenses, savings goals, and financial commitments, so that the Assistant has accurate data to work with.

#### Acceptance Criteria

1. WHEN the User submits a Transaction with amount, date, and description, THE Assistant SHALL validate that the amount is a positive number between 0.01 and 999,999,999.99, the date is in ISO 8601 format (YYYY-MM-DD) and not in the future, and the description is between 1 and 255 characters, then store it and display a confirmation message indicating the Transaction was saved
2. WHEN the User uploads a CSV file of up to 10,000 rows with columns in the order: date, description, amount, THE Assistant SHALL parse each row and store valid Transactions
3. IF a CSV row is missing required fields (amount, date, or description), THEN THE Assistant SHALL skip the row and report a descriptive error indicating the row number and missing field
4. IF the User submits a Transaction with an invalid amount, a malformed or future date, or a description exceeding 255 characters, THEN THE Assistant SHALL reject the submission and display an error message indicating which field failed validation
5. WHEN the User submits a Savings_Goal with a target amount between 0.01 and 999,999,999.99 and an optional deadline date, THE Assistant SHALL store it and associate it with the User's profile
6. WHEN the User submits a Financial_Commitment with an amount between 0.01 and 999,999,999.99 and a frequency of weekly, fortnightly, monthly, or yearly, THE Assistant SHALL store it and include it in budget calculations
7. THE Assistant SHALL accept income entries with a positive amount between 0.01 and 999,999,999.99, a date in ISO 8601 format (YYYY-MM-DD), and an optional source description of up to 255 characters

### Requirement 2: Automatic Expense Classification

**User Story:** As a User, I want my expenses automatically classified into categories, so that I can understand where my money goes without manual effort.

#### Acceptance Criteria

1. WHEN an expense Transaction is stored, THE Assistant SHALL assign it to exactly one Category based on the description within 2 seconds
2. THE Assistant SHALL support at minimum the following Categories: Housing, Transport, Groceries, Utilities, Entertainment, Dining, Health, Shopping, Subscriptions, and Other
3. WHEN the User corrects a Category assignment, THE Assistant SHALL update the Transaction and SHALL assign the corrected Category to all future Transactions with an identical description
4. THE Assistant SHALL classify Transactions using rule-based matching first, falling back to the LLM only when no rule produces a match, to minimise API costs
5. IF both rule-based matching and LLM classification fail or the LLM is unavailable, THEN THE Assistant SHALL assign the Transaction to the "Other" Category and indicate to the User that manual review is recommended

### Requirement 3: Budget Creation

**User Story:** As a User, I want the Assistant to create a weekly or monthly budget based on my income and commitments, so that I have a spending plan to follow.

#### Acceptance Criteria

1. WHEN the User requests a budget, THE Assistant SHALL generate a Budget allocating income across Categories for the chosen Budget_Period such that total allocations equal available income (income minus Financial_Commitments minus Savings_Goal contributions)
2. THE Assistant SHALL subtract Financial_Commitments and Savings_Goal contributions from available income before allocating discretionary spending
3. THE Assistant SHALL base category allocations on the User's historical spending patterns when at least one Budget_Period of Transaction data exists, proportioning each Category's allocation according to its share of past spending
4. WHEN no historical data exists, THE Assistant SHALL use the 50/30/20 heuristic (50% needs, 30% wants, 20% savings) to propose initial allocations
5. WHEN the User modifies a budget allocation, THE Assistant SHALL accept the change and redistribute the difference proportionally across remaining Categories to maintain a balanced budget where total allocations equal available income
6. IF Financial_Commitments and Savings_Goal contributions exceed total income, THEN THE Assistant SHALL inform the User that a budget cannot be created and display the shortfall amount

### Requirement 4: Planned vs Actual Spending Comparison

**User Story:** As a User, I want to compare my planned budget with my actual spending, so that I can see where I'm on track or overspending.

#### Acceptance Criteria

1. WHEN the User requests a spending comparison, THE Assistant SHALL display each Category's budgeted amount alongside actual spending for the current Budget_Period
2. WHEN a spending comparison is displayed, THE Assistant SHALL calculate and show the variance (actual minus planned) for each Category
3. WHEN a Category's actual spending is more than 10% below the budgeted amount, THE Assistant SHALL indicate that Category as under budget
4. WHEN a Category's actual spending is within 10% (inclusive) of the budgeted amount, THE Assistant SHALL indicate that Category as on track
5. WHEN a Category's actual spending exceeds the budgeted amount, THE Assistant SHALL indicate that Category as over budget
6. IF no Budget exists for the current Budget_Period when a comparison is requested, THEN THE Assistant SHALL inform the User that a budget must be created before a comparison can be shown

### Requirement 5: Spending Pattern Detection

**User Story:** As a User, I want the Assistant to identify unusual, unnecessary, or increasing expenses, so that I can make informed decisions about my spending.

#### Acceptance Criteria

1. WHEN at least two Budget_Periods of data exist, THE Assistant SHALL identify Categories where spending has increased by more than 20% compared to the immediately preceding Budget_Period and include each identified Category in the spending analysis results
2. WHEN a single Transaction exceeds twice the average Transaction amount for its Category computed over all stored Transactions in that Category, and at least three prior Transactions exist in that Category, THE Assistant SHALL flag it as unusual
3. WHEN the User requests a spending analysis, THE Assistant SHALL list all Transactions flagged as unusual and all Categories with increasing spending from the current and previous Budget_Period, with a plain-language explanation for each item stating the actual amount, the comparison baseline, and the percentage or multiple by which it deviates
4. IF the User requests a spending analysis and no unusual Transactions or increasing Categories are detected, THEN THE Assistant SHALL respond with a confirmation that no unusual spending patterns were found for the analysed period

### Requirement 6: Savings Recommendations

**User Story:** As a User, I want realistic savings targets recommended to me, so that I can build savings habits without feeling overwhelmed.

#### Acceptance Criteria

1. WHEN the User has a Savings_Goal with a deadline, THE Assistant SHALL calculate a recommended monthly contribution by dividing the remaining goal amount by the number of months until the deadline
2. WHEN the User has a Savings_Goal without a deadline, THE Assistant SHALL recommend a monthly contribution of 10% of discretionary income (income minus Financial_Commitments) toward that goal
3. IF the recommended monthly contribution exceeds 30% of discretionary income, THEN THE Assistant SHALL suggest a longer timeline or reduced goal amount and present both alternatives
4. IF the User has no Savings_Goal, THEN THE Assistant SHALL recommend a starter savings target equal to 10% of average monthly income computed over all available Budget_Periods (minimum one Budget_Period required)
5. THE Assistant SHALL present savings recommendations in plain language, including at least one concrete action with a specific numeric amount the User can act on

### Requirement 7: Financial Summaries

**User Story:** As a User, I want simple plain-language summaries of my finances, so that I can quickly understand my financial position.

#### Acceptance Criteria

1. WHEN the User requests a summary, THE Assistant SHALL generate a Financial_Summary covering total income, total spending, savings progress, and the top 3 spending Categories by amount for the current Budget_Period
2. THE Assistant SHALL present the Financial_Summary in plain language, using no abbreviations or technical financial terms without inline definitions
3. THE Assistant SHALL include a one-sentence assessment stating whether the User is on track (total actual spending does not exceed total budgeted spending for the current Budget_Period) or over budget (total actual spending exceeds total budgeted spending)
4. IF the User requests a summary and no Transaction data exists for the current Budget_Period, THEN THE Assistant SHALL inform the User that insufficient data is available and indicate what data is needed to generate a summary

### Requirement 8: Natural-Language Financial Q&A

**User Story:** As a User, I want to ask questions about my spending in plain English, so that I can get answers without navigating complex reports.

#### Acceptance Criteria

1. WHEN the User asks a question about their financial data, THE Assistant SHALL interpret the question and respond with specific numeric values (amounts, totals, percentages, or counts) derived from stored Transactions and Budgets
2. THE Assistant SHALL answer questions about spending in a specific Category, spending within a date range, comparisons between two Categories or two Budget_Periods, and trends across at least two consecutive Budget_Periods
3. IF the User asks a question that cannot be answered from available data, THEN THE Assistant SHALL explain what data is missing and what the User needs to provide
4. IF the User asks a question that is ambiguous or too broad to produce a single answer, THEN THE Assistant SHALL ask a clarifying follow-up question before responding
5. IF the User asks a question unrelated to their financial data, THEN THE Assistant SHALL inform the User that it can only answer questions about their finances
6. THE Assistant SHALL respond within 5 seconds for questions answerable from local data, and within 15 seconds for questions requiring LLM processing

### Requirement 9: Budget Alerts

**User Story:** As a User, I want to be alerted when I'm approaching or exceeding my budget, so that I can adjust my spending before it's too late.

#### Acceptance Criteria

1. WHEN a new Transaction is stored and spending in a Category reaches 80% of the budgeted amount for the current Budget_Period, THE Assistant SHALL generate a Spending_Alert indicating the User is approaching the limit
2. WHEN a new Transaction is stored and spending in a Category exceeds the budgeted amount for the current Budget_Period, THE Assistant SHALL generate a Spending_Alert indicating the budget has been exceeded
3. THE Assistant SHALL generate at most one warning alert (80% threshold) and one exceeded alert per Category per Budget_Period
4. WHEN a Spending_Alert is generated, THE Assistant SHALL include the Category name, amount spent, budgeted amount, and remaining balance (or overage amount if exceeded)
5. THE Assistant SHALL display active Spending_Alerts for the current Budget_Period at the top of the main dashboard view when the User opens the application
6. IF no Budget exists for the current Budget_Period, THEN THE Assistant SHALL not generate any Spending_Alerts

### Requirement 10: Spending Visualisation

**User Story:** As a User, I want to see spending trends and breakdowns visually, so that I can quickly grasp patterns in my finances.

#### Acceptance Criteria

1. THE Assistant SHALL display a category breakdown chart showing each Category's name, spent amount, and percentage of total spending for the current Budget_Period
2. IF at least two Budget_Periods of data exist, THEN THE Assistant SHALL display a trend chart plotting total spending per Budget_Period for up to the 12 most recent periods
3. THE Assistant SHALL render visualisations in the browser without requiring additional software installation
4. IF no Transaction data exists for the current Budget_Period, THEN THE Assistant SHALL display a message indicating that no spending data is available for visualisation

### Requirement 11: Responsible Use Disclaimer

**User Story:** As a User, I want to understand the limitations of the advice I receive, so that I do not mistake it for professional financial guidance.

#### Acceptance Criteria

1. THE Assistant SHALL display a disclaimer stating that it provides general budgeting support and does not constitute professional financial, investment, tax, or legal advice
2. WHEN the User asks about investment decisions, tax strategies, or debt restructuring, THE Assistant SHALL include a reminder to consult a qualified financial professional before providing any general information on the topic
3. IF the User asks about investment decisions, tax strategies, or debt restructuring, THEN THE Assistant SHALL NOT provide specific recommendations and SHALL limit its response to general educational information alongside the professional consultation reminder
4. WHEN the User opens the application for the first time, THE Assistant SHALL display the disclaimer in a dedicated notice that the User must acknowledge before proceeding
5. THE Assistant SHALL display the disclaimer text in the application footer on every page, using the same font size as the primary body text

### Requirement 12: Privacy and Data Handling

**User Story:** As a User, I want my financial data handled securely and privately, so that I can trust the application with sensitive information.

#### Acceptance Criteria

1. THE Assistant SHALL store all User financial data (Transactions, Budgets, Savings_Goals, Financial_Commitments, and classification corrections) locally on the User's device
2. THE Assistant SHALL send only transaction descriptions for classification and aggregated totals for summaries to the LLM, and SHALL NOT send raw account numbers, full transaction histories, or personally identifiable information
3. WHEN the User requests data deletion, THE Assistant SHALL remove all stored financial data (Transactions, Budgets, Savings_Goals, Financial_Commitments, and classification corrections) within 5 seconds and display a confirmation message indicating that deletion is complete
4. THE Assistant SHALL not transmit User data to any external service other than the LLM used for classification and summary generation as described in criterion 2
5. WHEN the User requests to see what data is sent to the LLM, THE Assistant SHALL display a summary describing the types of data shared with the LLM and the purposes for which they are sent

### Requirement 13: CSV Export

**User Story:** As a User, I want to export my financial data, so that I can keep a backup or use it in other tools.

#### Acceptance Criteria

1. WHEN the User requests an export, THE Assistant SHALL generate a CSV file containing all stored Transactions with their assigned Categories, ordered by date ascending
2. THE Assistant SHALL include column headers (date, description, amount, category) as the first row of the exported file
3. THE Assistant SHALL format dates in ISO 8601 format (YYYY-MM-DD) and amounts as decimal numbers with exactly two decimal places
4. IF a Transaction description contains commas or double quotes, THEN THE Assistant SHALL escape the field according to RFC 4180 CSV formatting rules
5. THE Assistant SHALL trigger a browser download of the generated CSV file with a filename in the format "budget_export_YYYY-MM-DD.csv"
6. IF no Transactions are stored when export is requested, THEN THE Assistant SHALL inform the User that there is no data to export
